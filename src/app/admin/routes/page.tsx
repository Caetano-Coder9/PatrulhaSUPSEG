"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RoutesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("patrol_routes")
      .select("*, location:locations(name), route_checkpoints(id)")
      .order("name")
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Rotas</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div className="font-semibold text-white">{r.name}</div>
            <div className="text-sm text-gray-400 mt-1">{r.location?.name}</div>
            <div className="text-xs text-gray-500 mt-2 flex gap-3">
              <span>Horário: {r.scheduled_time?.slice(0, 5) ?? "—"}</span>
              <span>Tolerância: {r.tolerance_minutes} min</span>
              <span>{r.route_checkpoints?.length ?? 0} checkpoints</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-500">Nenhuma rota. Execute o seed SQL.</p>}
      </div>
    </div>
  );
}
