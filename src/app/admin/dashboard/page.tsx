"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  MapPin,
  QrCode,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatDateTime, statusLabel } from "@/lib/utils/format";
import type { PatrolLog, Incident } from "@/lib/types";

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    agents: 0,
    locations: 0,
    checkpoints: 0,
    sessionsToday: 0,
    openIncidents: 0,
  });
  const [liveLogs, setLiveLogs] = useState<
    (PatrolLog & { checkpoint?: { code: string; name: string }; guard?: { full_name: string } })[]
  >([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    loadStats();
    loadLiveFeed();
    loadIncidents();

    const channel = supabase
      .channel("admin-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patrol_logs" },
        () => loadLiveFeed()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => loadIncidents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadStats() {
    const [agents, locations, checkpoints, sessions, openInc] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "guard").eq("is_active", true),
      supabase.from("locations").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("checkpoints").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("patrol_sessions")
        .select("id", { count: "exact", head: true })
        .gte("started_at", new Date().toISOString().slice(0, 10)),
      supabase.from("incidents").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    ]);
    setStats({
      agents: agents.count ?? 0,
      locations: locations.count ?? 0,
      checkpoints: checkpoints.count ?? 0,
      sessionsToday: sessions.count ?? 0,
      openIncidents: openInc.count ?? 0,
    });
  }

  async function loadLiveFeed() {
    const { data } = await supabase
      .from("patrol_logs")
      .select("*, checkpoint:checkpoints(code, name), guard:profiles(full_name)")
      .order("scanned_at", { ascending: false })
      .limit(25);
    setLiveLogs((data as any) ?? []);
  }

  async function loadIncidents() {
    const { data } = await supabase
      .from("incidents")
      .select("*")
      .order("reported_at", { ascending: false })
      .limit(10);
    setIncidents(data ?? []);
  }

  const cards = [
    { label: "Agentes ativos", value: stats.agents, icon: Users, color: "text-teal-400" },
    { label: "Postos", value: stats.locations, icon: MapPin, color: "text-blue-400" },
    { label: "Checkpoints", value: stats.checkpoints, icon: QrCode, color: "text-purple-400" },
    { label: "Rondas hoje", value: stats.sessionsToday, icon: ClipboardCheck, color: "text-green-400" },
    { label: "Ocorrências abertas", value: stats.openIncidents, icon: AlertTriangle, color: "text-yellow-400" },
  ];

  function gpsBadge(status: string | null) {
    if (!status) return null;
    const map: Record<string, string> = {
      verified: "bg-green-900/50 text-green-300",
      outside_radius: "bg-red-900/50 text-red-300",
      low_accuracy: "bg-yellow-900/50 text-yellow-300",
      permission_denied: "bg-gray-700 text-gray-300",
      unavailable: "bg-gray-700 text-gray-300",
    };
    return (
      <span className={`status-badge ${map[status] ?? "bg-gray-700"}`}>
        {statusLabel(status)}
      </span>
    );
  }

  function logStatusBadge(status: string) {
    const map: Record<string, string> = {
      completed: "bg-green-900/50 text-green-300",
      late: "bg-yellow-900/50 text-yellow-300",
      out_of_sequence: "bg-orange-900/50 text-orange-300",
      missed: "bg-red-900/50 text-red-300",
    };
    return (
      <span className={`status-badge ${map[status] ?? "bg-gray-700"}`}>
        {statusLabel(status)}
      </span>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Visão geral em tempo real das operações
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-gray-400 mt-1">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Live feed */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h2 className="font-semibold text-white">Feed de auditoria em tempo real</h2>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {liveLogs.length === 0 && (
              <p className="text-gray-500 text-sm py-8 text-center">
                Nenhuma leitura recente
              </p>
            )}
            {liveLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#0a192f]/60 border border-[#1e3a5f]/50"
              >
                <div className="mt-0.5">
                  {log.is_gps_valid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-white">
                      {(log as any).guard?.full_name ?? "Agente"}
                    </span>
                    <span className="text-gray-500">·</span>
                    <span className="text-teal-400 font-mono">
                      {(log as any).checkpoint?.code} – {(log as any).checkpoint?.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(log.scanned_at)}
                    {log.gps_distance_meters != null && (
                      <span>· {log.gps_distance_meters}m</span>
                    )}
                    {gpsBadge(log.gps_status)}
                    {logStatusBadge(log.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incidents */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Ocorrências recentes
          </h2>
          <div className="space-y-3 max-h-[480px] overflow-y-auto">
            {incidents.length === 0 && (
              <p className="text-gray-500 text-sm py-6 text-center">Nenhuma ocorrência</p>
            )}
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 rounded-xl bg-[#0a192f]/60 border border-[#1e3a5f]/50"
              >
                <div className="font-medium text-sm text-white truncate">{inc.title}</div>
                <div className="flex items-center gap-2 mt-1.5 text-xs">
                  <span
                    className={`status-badge ${
                      inc.severity === "high"
                        ? "bg-red-900/50 text-red-300"
                        : inc.severity === "medium"
                        ? "bg-yellow-900/50 text-yellow-300"
                        : "bg-blue-900/50 text-blue-300"
                    }`}
                  >
                    {inc.severity === "high" ? "Alta" : inc.severity === "medium" ? "Média" : "Baixa"}
                  </span>
                  <span
                    className={`status-badge ${
                      inc.status === "resolved"
                        ? "bg-green-900/50 text-green-300"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {statusLabel(inc.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
