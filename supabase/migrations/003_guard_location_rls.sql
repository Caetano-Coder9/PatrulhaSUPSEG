-- Assign the guard's current location without changing historical patrol snapshots.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_location_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES public.locations(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location_id);

-- Guards may update personal fields only; the current location remains admin-controlled.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles AS p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles AS p WHERE p.id = auth.uid())
    AND location_id IS NOT DISTINCT FROM (
      SELECT p.location_id FROM public.profiles AS p WHERE p.id = auth.uid()
    )
  );

-- Guards can only read active routes from their current location.
DROP POLICY IF EXISTS "Authenticated can read active routes" ON public.patrol_routes;

CREATE POLICY "Guards can read routes for own location"
  ON public.patrol_routes FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.role = 'guard'
        AND p.is_active = true
        AND p.location_id = patrol_routes.location_id
    )
  );

-- Keep route/location/guard identity immutable after a session is created.
CREATE OR REPLACE FUNCTION public.validate_patrol_session_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  route_location_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.guard_id IS DISTINCT FROM OLD.guard_id
      OR NEW.route_id IS DISTINCT FROM OLD.route_id
      OR NEW.location_id IS DISTINCT FROM OLD.location_id
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
      RAISE EXCEPTION 'Patrol session identity fields are immutable';
    END IF;

    RETURN NEW;
  END IF;

  SELECT pr.location_id
    INTO route_location_id
    FROM public.patrol_routes AS pr
   WHERE pr.id = NEW.route_id;

  IF route_location_id IS NULL THEN
    RAISE EXCEPTION 'Patrol session route does not exist';
  END IF;

  IF NEW.location_id IS DISTINCT FROM route_location_id THEN
    RAISE EXCEPTION 'Patrol session location must match the route location';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_patrol_session_integrity
  ON public.patrol_sessions;

CREATE TRIGGER trg_validate_patrol_session_integrity
  BEFORE INSERT OR UPDATE ON public.patrol_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_patrol_session_integrity();

DROP POLICY IF EXISTS "Guards can create own sessions" ON public.patrol_sessions;

CREATE POLICY "Guards can create own sessions"
  ON public.patrol_sessions FOR INSERT
  WITH CHECK (
    guard_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      JOIN public.patrol_routes AS pr
        ON pr.location_id = p.location_id
       AND pr.id = patrol_sessions.route_id
      WHERE p.id = auth.uid()
        AND p.role = 'guard'
        AND p.is_active = true
        AND p.location_id IS NOT NULL
        AND pr.is_active = true
        AND patrol_sessions.location_id = pr.location_id
    )
  );

DROP POLICY IF EXISTS "Guards update own sessions, admins all" ON public.patrol_sessions;

CREATE POLICY "Guards update own sessions, admins all"
  ON public.patrol_sessions FOR UPDATE
  USING (guard_id = auth.uid() OR public.is_admin())
  WITH CHECK (guard_id = auth.uid() OR public.is_admin());

-- A guard may insert only a log for their own session, using that session's route
-- and one of the checkpoints explicitly assigned to that route.
DROP POLICY IF EXISTS "Guards insert own logs" ON public.patrol_logs;

CREATE POLICY "Guards insert own logs"
  ON public.patrol_logs FOR INSERT
  WITH CHECK (
    guard_id = auth.uid()
    AND patrol_session_id IS NOT NULL
    AND route_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.patrol_sessions AS ps
      JOIN public.route_checkpoints AS rc
        ON rc.route_id = ps.route_id
       AND rc.checkpoint_id = patrol_logs.checkpoint_id
      WHERE ps.id = patrol_logs.patrol_session_id
        AND ps.guard_id = auth.uid()
        AND ps.route_id = patrol_logs.route_id
    )
  );

-- Guards can only read active checkpoints assigned to active routes in their location.
DROP POLICY IF EXISTS "Authenticated can read active checkpoints" ON public.checkpoints;

CREATE POLICY "Guards can read checkpoints for own location"
  ON public.checkpoints FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.route_checkpoints AS rc
      JOIN public.patrol_routes AS pr
        ON pr.id = rc.route_id
      JOIN public.profiles AS p
        ON p.id = auth.uid()
      WHERE rc.checkpoint_id = checkpoints.id
        AND pr.is_active = true
        AND p.role = 'guard'
        AND p.is_active = true
        AND p.location_id = pr.location_id
    )
  );

-- Guards can only read route/checkpoint links for active routes in their location.
DROP POLICY IF EXISTS "Authenticated can read route_checkpoints" ON public.route_checkpoints;

CREATE POLICY "Guards can read route checkpoints for own location"
  ON public.route_checkpoints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.patrol_routes AS pr
      JOIN public.profiles AS p
        ON p.id = auth.uid()
      WHERE pr.id = route_checkpoints.route_id
        AND pr.is_active = true
        AND p.role = 'guard'
        AND p.is_active = true
        AND p.location_id = pr.location_id
    )
  );
