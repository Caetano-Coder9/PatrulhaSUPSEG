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
    totalSessions: 0,
    completedSessions: 0,
    openIncidents: 0,
    highSeverity: 0,
  });

  useEffect(() => {
    (async () => {
      const [logs, sessions, incidents] = await Promise.all([
        supabase.from("patrol_logs").select("status"),
        supabase.from("patrol_sessions").select("status"),
        supabase.from("incidents").select("severity, status"),
      ]);
      const logRows = logs.data ?? [];
      const sessRows = sessions.data ?? [];
      const incRows = incidents.data ?? [];
      setStats({
        totalLogs: logRows.length,
        completed: logRows.filter((l) => l.status === "completed").length,
        late: logRows.filter((l) => l.status === "late").length,
        outOfSeq: logRows.filter((l) => l.status === "out_of_sequence").length,
        totalSessions: sessRows.length,
        completedSessions: sessRows.filter((s) => s.status === "completed").length,
        openIncidents: incRows.filter((i) => i.status !== "resolved").length,
        highSeverity: incRows.filter((i) => i.severity === "high").length,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-2xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
