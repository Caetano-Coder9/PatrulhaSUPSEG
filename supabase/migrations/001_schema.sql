-- ============================================================
-- SUPSEGPatrulha - Schema Completo
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELAS
-- ============================================================

-- Profiles (vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guard')),
  shift_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locations (Postos / Sites)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  qr_code_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  target_lat DOUBLE PRECISION,
  target_lng DOUBLE PRECISION,
  gps_radius_meters INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patrol Routes
CREATE TABLE IF NOT EXISTS public.patrol_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scheduled_time TIME,
  tolerance_minutes INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Route Checkpoints (ordem da rota)
CREATE TABLE IF NOT EXISTS public.route_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.patrol_routes(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, checkpoint_id),
  UNIQUE (route_id, sequence_order)
);

-- Patrol Sessions
CREATE TABLE IF NOT EXISTS public.patrol_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.patrol_routes(id),
  guard_id UUID NOT NULL REFERENCES public.profiles(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'missed', 'late')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patrol Logs (leituras de checkpoints)
CREATE TABLE IF NOT EXISTS public.patrol_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrol_session_id UUID REFERENCES public.patrol_sessions(id),
  route_id UUID REFERENCES public.patrol_routes(id),
  guard_id UUID NOT NULL REFERENCES public.profiles(id),
  checkpoint_id UUID NOT NULL REFERENCES public.checkpoints(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_lat DOUBLE PRECISION,
  scanned_lng DOUBLE PRECISION,
  gps_accuracy_meters DOUBLE PRECISION,
  gps_distance_meters DOUBLE PRECISION,
  is_gps_valid BOOLEAN DEFAULT false,
  gps_status TEXT CHECK (gps_status IN (
    'verified', 'outside_radius', 'low_accuracy', 'permission_denied', 'unavailable'
  )),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'missed', 'late', 'out_of_sequence')),
  client_event_id TEXT UNIQUE,
  synced_offline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- Incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES public.profiles(id),
  location_id UUID REFERENCES public.locations(id),
  checkpoint_id UUID REFERENCES public.checkpoints(id),
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  client_event_id TEXT UNIQUE,
  synced_offline BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sync Queue (opcional no servidor para auditoria; principal é no cliente)
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checkpoints_location ON public.checkpoints(location_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_token ON public.checkpoints(qr_code_token);
CREATE INDEX IF NOT EXISTS idx_route_checkpoints_route ON public.route_checkpoints(route_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_guard ON public.patrol_logs(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_session ON public.patrol_logs(patrol_session_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_scanned_at ON public.patrol_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_client_event ON public.patrol_logs(client_event_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_client_event ON public.incidents(client_event_id);
CREATE INDEX IF NOT EXISTS idx_patrol_sessions_guard ON public.patrol_sessions(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrol_sessions_status ON public.patrol_sessions(status);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_locations_updated
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_checkpoints_updated
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_routes_updated
  BEFORE UPDATE ON public.patrol_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: criar profile ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'guard')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Helper: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

-- Locations
CREATE POLICY "Authenticated can read active locations"
  ON public.locations FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage locations"
  ON public.locations FOR ALL
  USING (public.is_admin());

-- Checkpoints
CREATE POLICY "Authenticated can read active checkpoints"
  ON public.checkpoints FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage checkpoints"
  ON public.checkpoints FOR ALL
  USING (public.is_admin());

-- Routes
CREATE POLICY "Authenticated can read active routes"
  ON public.patrol_routes FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage routes"
  ON public.patrol_routes FOR ALL
  USING (public.is_admin());

-- Route checkpoints
CREATE POLICY "Authenticated can read route_checkpoints"
  ON public.route_checkpoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage route_checkpoints"
  ON public.route_checkpoints FOR ALL
  USING (public.is_admin());

-- Patrol sessions
CREATE POLICY "Guards see own sessions, admins see all"
  ON public.patrol_sessions FOR SELECT
  USING (guard_id = auth.uid() OR public.is_admin());

CREATE POLICY "Guards can create own sessions"
  ON public.patrol_sessions FOR INSERT
  WITH CHECK (guard_id = auth.uid());

CREATE POLICY "Guards update own sessions, admins all"
  ON public.patrol_sessions FOR UPDATE
  USING (guard_id = auth.uid() OR public.is_admin());

-- Patrol logs
CREATE POLICY "Guards see own logs, admins all"
  ON public.patrol_logs FOR SELECT
  USING (guard_id = auth.uid() OR public.is_admin());

CREATE POLICY "Guards insert own logs"
  ON public.patrol_logs FOR INSERT
  WITH CHECK (guard_id = auth.uid());

CREATE POLICY "Admins manage logs"
  ON public.patrol_logs FOR ALL
  USING (public.is_admin());

-- Incidents
CREATE POLICY "Guards see own incidents, admins all"
  ON public.incidents FOR SELECT
  USING (guard_id = auth.uid() OR public.is_admin());

CREATE POLICY "Guards insert own incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (guard_id = auth.uid());

CREATE POLICY "Admins and reporter can update incidents"
  ON public.incidents FOR UPDATE
  USING (guard_id = auth.uid() OR public.is_admin());

-- Sync queue (apenas admin)
CREATE POLICY "Admins manage sync_queue"
  ON public.sync_queue FOR ALL
  USING (public.is_admin());

-- ============================================================
-- STORAGE (bucket de fotos de incidentes)
-- ============================================================
-- Execute no Dashboard > Storage ou via SQL se permitido:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('incident-photos', 'incident-photos', false);

-- Políticas de Storage (ajuste conforme necessário no Dashboard):
-- - Authenticated users podem fazer upload em incident-photos/
-- - Apenas o dono ou admin pode ler

COMMENT ON TABLE public.profiles IS 'Agentes e administradores';
COMMENT ON TABLE public.locations IS 'Postos / sites de operação';
COMMENT ON TABLE public.checkpoints IS 'Pontos de controle com QR e GPS';
COMMENT ON TABLE public.patrol_routes IS 'Rotas de ronda programadas';
COMMENT ON TABLE public.patrol_logs IS 'Leituras de checkpoints com validação GPS';
COMMENT ON TABLE public.incidents IS 'Ocorrências reportadas pelos agentes';
