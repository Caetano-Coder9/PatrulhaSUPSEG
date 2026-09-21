"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Play, MapPin, Clock, CheckCircle2, Circle } from "lucide-react";
import type { PatrolRoute, Profile } from "@/lib/types";
import { db } from "@/lib/offline/db";
import { enqueuePatrolSession } from "@/lib/offline/sync";
import { createClientEventId } from "@/lib/offline/sync";

export default function MobileHome() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState<PatrolRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof, error: profileError } = await supabase
      .from("profiles")
      .select("*, location:locations(*)")
      .eq("id", user.id)
      .single();
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    let rts: any[] = [];
    if (prof?.location_id) {
      const { data, error: routesError } = await supabase
        .from("patrol_routes")
        .select("*, location:locations(*), route_checkpoints(*, checkpoint:checkpoints(*))")
        .eq("location_id", prof.location_id)
        .eq("is_active", true);
      if (routesError) {
        setError(routesError.message);
        setLoading(false);
        return;
      }
      rts = data ?? [];
    }

    /*
     * The active route is a local snapshot. It is only resumable when it was
     * created by the authenticated guard and still belongs to that guard's
     * current location.
     */
    setProfile(prof);
    setRoutes((rts as any) ?? []);
    if (db) {
      const ar = await db.activeRoute.toArray();
      if (ar[0]?.status === "completed") {
        await db.activeRoute.delete(ar[0].id);
      } else if (
        ar[0]?.guardId === user.id &&
        ar[0]?.locationId === prof?.location_id
      ) {
        setActive(ar[0]);
      }
    }
    setLoading(false);
  }

  async function startRoute(route: PatrolRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!profile?.location_id || route.location_id !== profile.location_id) {
      setError("Esta rota não pertence ao seu posto actual.");
      return;
    }

    const ordered = [...(route.route_checkpoints ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );

    const clientSessionId = createClientEventId();
    let sessionId: string | null = clientSessionId;
    if (navigator.onLine) {
      const { data, error: sessionError } = await supabase
        .from("patrol_sessions")
        .insert({
          id: clientSessionId,
          route_id: route.id,
          guard_id: user.id,
          location_id: route.location_id,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      sessionId = data?.id ?? clientSessionId;
    }

    const state = {
      id: user.id,
      guardId: user.id,
      sessionId,
      clientSessionId,
      routeId: route.id,
      routeName: route.name,
      locationId: route.location_id,
      locationName: (route as any).location?.name ?? "",
      startedAt: new Date().toISOString(),
      status: "in_progress" as const,
      checkpoints: ordered.map((rc) => ({
        id: rc.checkpoint_id,
        code: (rc as any).checkpoint?.code ?? "",
        name: (rc as any).checkpoint?.name ?? "",
        sequence_order: rc.sequence_order,
        qr_code_token: (rc as any).checkpoint?.qr_code_token ?? "",
        target_lat: (rc as any).checkpoint?.target_lat ?? null,
        target_lng: (rc as any).checkpoint?.target_lng ?? null,
        gps_radius_meters: (rc as any).checkpoint?.gps_radius_meters ?? 30,
        status: "pending" as const,
      })),
    };

    if (db) {
      await db.activeRoute.put(state);
      if (!navigator.onLine) await enqueuePatrolSession(state, user.id);
    }
    setActive(state);
    setSelectedRoute(null);
    router.push("/mobile/scan");
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">Carregando...</div>
    );
  }

  const currentLocation = (profile as Profile & { location?: { name: string } } | null)?.location;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          Olá, {profile?.full_name?.split(" ")[0] ?? "Agente"}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {profile?.shift_info ?? "Turno não definido"}
        </p>
      </div>

      {error && (
        <div className="card border-red-700/50 text-sm text-red-200">{error}</div>
      )}

      <div className="card">
        <div className="text-xs uppercase tracking-wide text-gray-400">Posto actual</div>
        <div className="mt-1 flex items-center gap-2 text-white font-semibold">
          <MapPin className="w-4 h-4 text-teal-400" />
          {currentLocation?.name ?? "Nenhum posto atribuído"}
        </div>
        {!profile?.location_id && (
          <p className="text-sm text-yellow-300 mt-2">
            Contacte o administrador para receber um posto antes de iniciar uma ronda.
          </p>
        )}
      </div>

      {active && (
        <div className="card border-teal-700/50">
          <div className="flex items-center gap-2 text-teal-400 text-sm font-medium mb-2">
            <Play className="w-4 h-4" /> Ronda em andamento
          </div>
          <div className="font-semibold text-white">{active.routeName}</div>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {active.locationName}
          </div>
          <button className="btn-primary w-full mt-4" onClick={() => router.push("/mobile/scan")}>
            Continuar escaneamento
          </button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Rotas disponíveis</h2>
        {!profile?.location_id && <p className="text-gray-500 text-sm">Nenhuma rota disponível.</p>}
        {profile?.location_id && routes.length === 0 && (
          <p className="text-gray-500 text-sm">Nenhuma rota activa neste posto.</p>
        )}
        <div className="space-y-3">
          {routes.map((r) => (
            <div key={r.id} className={`card ${selectedRoute?.id === r.id ? "border-teal-500/70" : ""}`}>
              <div className="font-medium text-white">{r.name}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{(r as any).location?.name}</span>
                {r.scheduled_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.scheduled_time.slice(0, 5)}</span>}
                <span>{(r.route_checkpoints ?? []).length} pontos</span>
              </div>
              <button
                className="btn-secondary w-full mt-3"
                onClick={() => setSelectedRoute(r)}
                disabled={!!active}
              >
                {selectedRoute?.id === r.id ? "Rota seleccionada" : "Seleccionar rota"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedRoute && !active && (
        <div className="card border-teal-700/50">
          <div className="text-sm text-teal-400 font-medium">Rota seleccionada</div>
          <div className="text-white font-semibold mt-1">{selectedRoute.name}</div>
          <div className="text-xs text-gray-400 mt-2 space-y-1">
            <div>Posto: {(selectedRoute as any).location?.name}</div>
            <div>Checkpoints: {(selectedRoute.route_checkpoints ?? []).length}</div>
            <div>Horário: {selectedRoute.scheduled_time?.slice(0, 5) ?? "—"}</div>
          </div>
          <button className="btn-primary w-full mt-4" onClick={() => startRoute(selectedRoute)}>
            <Play className="w-4 h-4 inline mr-2" /> Iniciar ronda
          </button>
        </div>
      )}
    </div>
  );
}
