"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Play, MapPin, Clock, CheckCircle2, Circle } from "lucide-react";
import type { PatrolRoute, Profile } from "@/lib/types";
import { db } from "@/lib/offline/db";

export default function MobileHome() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { data: rts }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("patrol_routes")
        .select("*, location:locations(*), route_checkpoints(*, checkpoint:checkpoints(*))")
        .eq("is_active", true),
    ]);
    setProfile(prof);
    setRoutes((rts as any) ?? []);

    if (db) {
      const ar = await db.activeRoute.toArray();
      if (ar[0]) setActive(ar[0]);
    }
    setLoading(false);
  }

  async function startRoute(route: PatrolRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const ordered = [...(route.route_checkpoints ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );

    // Cria sessão no servidor se online
    let sessionId: string | null = null;
    if (navigator.onLine) {
      const { data } = await supabase
        .from("patrol_sessions")
        .insert({
          route_id: route.id,
          guard_id: user.id,
          location_id: route.location_id,
          status: "in_progress",
        })
        .select("id")
        .single();
      sessionId = data?.id ?? null;
    }

    const state = {
      id: "current",
      sessionId,
      routeId: route.id,
      routeName: route.name,
      locationId: route.location_id,
      locationName: (route as any).location?.name ?? "",
      startedAt: new Date().toISOString(),
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
      await db.activeRoute.clear();
      await db.activeRoute.put(state);
    }
    setActive(state);
    router.push("/mobile/scan");
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">Carregando...</div>
    );
  }

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

      {active && (
        <div className="card border-teal-700/50">
          <div className="flex items-center gap-2 text-teal-400 text-sm font-medium mb-2">
            <Play className="w-4 h-4" /> Ronda em andamento
          </div>
          <div className="font-semibold text-white">{active.routeName}</div>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {active.locationName}
          </div>
          <div className="mt-3 space-y-1.5">
            {active.checkpoints.map((cp: any) => (
              <div key={cp.id} className="flex items-center gap-2 text-sm">
                {cp.status === "scanned" || cp.status === "out_of_sequence" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-600" />
                )}
                <span className={cp.status === "pending" ? "text-gray-400" : "text-white"}>
                  {cp.code} – {cp.name}
                </span>
              </div>
            ))}
          </div>
          <button
            className="btn-primary w-full mt-4"
            onClick={() => router.push("/mobile/scan")}
          >
            Continuar escaneamento
          </button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Rotas disponíveis</h2>
        <div className="space-y-3">
          {routes.length === 0 && (
            <p className="text-gray-500 text-sm">Nenhuma rota ativa</p>
          )}
          {routes.map((r) => (
            <div key={r.id} className="card">
              <div className="font-medium text-white">{r.name}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {(r as any).location?.name}
                </span>
                {r.scheduled_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {r.scheduled_time.slice(0, 5)}
                  </span>
                )}
                <span>{(r.route_checkpoints ?? []).length} pontos</span>
              </div>
              <button
                className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
                onClick={() => startRoute(r)}
                disabled={!!active}
              >
                <Play className="w-4 h-4" /> Iniciar ronda
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
