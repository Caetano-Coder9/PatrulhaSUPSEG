"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReportsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalLogs: 0,
    completed: 0,
    late: 0,
    outOfSeq: 0,
    invalidGps: 0,
    totalSessions: 0,
    completedSessions: 0,
    activeSessions: 0,
    openIncidents: 0,
    inProgressIncidents: 0,
    resolvedIncidents: 0,
    highSeverity: 0,
    totalAgents: 0,
    activeAgents: 0,
    totalLocations: 0,
    activeLocations: 0,
    totalRoutes: 0,
    activeRoutes: 0,
  });

  useEffect(() => {
    (async () => {
      const [logs, sessions, incidents, agents, locations, routes] = await Promise.all([
        supabase.from("patrol_logs").select("status, is_gps_valid"),
        supabase.from("patrol_sessions").select("status"),
        supabase.from("incidents").select("severity, status"),
        supabase.from("profiles").select("role, is_active").eq("role", "guard"),
        supabase.from("locations").select("is_active"),
        supabase.from("patrol_routes").select("is_active"),
      ]);
      const logRows = logs.data ?? [];
      const sessRows = sessions.data ?? [];
      const incRows = incidents.data ?? [];
      const agentRows = agents.data ?? [];
      const locationRows = locations.data ?? [];
      const routeRows = routes.data ?? [];
      setStats({
        totalLogs: logRows.length,
        completed: logRows.filter((l) => l.status === "completed").length,
        late: logRows.filter((l) => l.status === "late").length,
        outOfSeq: logRows.filter((l) => l.status === "out_of_sequence").length,
        invalidGps: logRows.filter((l) => !l.is_gps_valid).length,
        totalSessions: sessRows.length,
        completedSessions: sessRows.filter((s) => s.status === "completed").length,
        activeSessions: sessRows.filter((s) => s.status === "in_progress").length,
        openIncidents: incRows.filter((i) => i.status !== "resolved").length,
        inProgressIncidents: incRows.filter((i) => i.status === "in_progress").length,
        resolvedIncidents: incRows.filter((i) => i.status === "resolved").length,
        highSeverity: incRows.filter((i) => i.severity === "high").length,
        totalAgents: agentRows.length,
        activeAgents: agentRows.filter((agent) => agent.is_active).length,
        totalLocations: locationRows.length,
        activeLocations: locationRows.filter((location) => location.is_active).length,
        totalRoutes: routeRows.length,
        activeRoutes: routeRows.filter((route) => route.is_active).length,
      });
    })();
  }, []);

  const cards = [
    { label: "Total de leituras", value: stats.totalLogs },
    { label: "Leituras concluídas", value: stats.completed },
    { label: "Atrasadas", value: stats.late },
    { label: "Fora de sequência", value: stats.outOfSeq },
    { label: "Sessões de ronda", value: stats.totalSessions },
    { label: "Sessões concluídas", value: stats.completedSessions },
    { label: "Ocorrências abertas", value: stats.openIncidents },
    { label: "Severidade alta", value: stats.highSeverity },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Relatórios</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Rondas e leituras</h2>
          <div className="grid grid-cols-2 gap-4">
            {cards.slice(0, 6).map((c) => <Metric key={c.label} label={c.label} value={c.value} />)}
            <Metric label="GPS inválido" value={stats.invalidGps} />
            <Metric label="Sessões em andamento" value={stats.activeSessions} />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Ocorrências</h2>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Abertas" value={stats.openIncidents} />
            <Metric label="Em análise" value={stats.inProgressIncidents} />
            <Metric label="Resolvidas" value={stats.resolvedIncidents} />
            <Metric label="Severidade alta" value={stats.highSeverity} />
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Operação</h2>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Agentes" value={stats.totalAgents} />
            <Metric label="Agentes ativos" value={stats.activeAgents} />
            <Metric label="Postos" value={stats.totalLocations} />
            <Metric label="Postos ativos" value={stats.activeLocations} />
            <Metric label="Rotas" value={stats.totalRoutes} />
            <Metric label="Rotas ativas" value={stats.activeRoutes} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
