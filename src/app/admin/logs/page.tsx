"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, statusLabel } from "@/lib/utils/format";

export default function LogsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("patrol_logs")
      .select("*, checkpoint:checkpoints(code, name), guard:profiles(full_name)")
      .order("scanned_at", { ascending: false })
      .limit(150)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Logs de Ronda</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[#1e3a5f]">
              <th className="pb-3 pr-4">Agente</th>
              <th className="pb-3 pr-4">Checkpoint</th>
              <th className="pb-3 pr-4">Horário</th>
              <th className="pb-3 pr-4">Distância</th>
              <th className="pb-3 pr-4">GPS</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#1e3a5f]/40">
                <td className="py-3 pr-4 text-white">{r.guard?.full_name ?? "—"}</td>
                <td className="py-3 pr-4 font-mono text-teal-400">
                  {r.checkpoint?.code} – {r.checkpoint?.name}
                </td>
                <td className="py-3 pr-4 text-xs text-gray-300">{formatDateTime(r.scanned_at)}</td>
                <td className="py-3 pr-4 text-gray-400">
                  {r.gps_distance_meters != null ? `${r.gps_distance_meters}m` : "—"}
                </td>
                <td className="py-3 pr-4 text-xs">{statusLabel(r.gps_status ?? "")}</td>
                <td className="py-3 text-xs">{statusLabel(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-gray-500 text-center py-8">Nenhum log ainda</p>}
      </div>
    </div>
  );
}
