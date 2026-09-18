"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, statusLabel, severityLabel } from "@/lib/utils/format";

export default function IncidentsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("incidents")
      .select("*, guard:profiles(full_name), checkpoint:checkpoints(code, name)")
      .order("reported_at", { ascending: false });
    setRows(data ?? []);
  }

  async function resolve(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      })
      .eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Ocorrências</h1>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="card flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="font-semibold text-white">{r.title}</div>
              <div className="text-sm text-gray-400 mt-1">{r.description}</div>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="status-badge bg-gray-700 text-gray-300">
                  {r.guard?.full_name}
                </span>
                <span className={`status-badge ${
                  r.severity === "high" ? "bg-red-900/50 text-red-300" :
                  r.severity === "medium" ? "bg-yellow-900/50 text-yellow-300" :
                  "bg-blue-900/50 text-blue-300"
                }`}>
                  {severityLabel(r.severity)}
                </span>
                <span className="status-badge bg-gray-700 text-gray-300">
                  {statusLabel(r.status)}
                </span>
                <span className="text-gray-500">{formatDateTime(r.reported_at)}</span>
              </div>
            </div>
            {r.status !== "resolved" && (
              <button className="btn-primary text-sm py-2" onClick={() => resolve(r.id)}>
                Resolver
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-500">Nenhuma ocorrência</p>}
      </div>
    </div>
  );
}
