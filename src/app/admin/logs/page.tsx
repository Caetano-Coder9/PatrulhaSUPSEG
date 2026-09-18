"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, statusLabel } from "@/lib/utils/format";
import { Search, X } from "lucide-react";

export default function LogsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error: queryError } = await supabase
      .from("patrol_logs")
      .select("*, checkpoint:checkpoints(code, name), guard:profiles(full_name), route:patrol_routes(name)")
      .order("scanned_at", { ascending: false })
      .limit(150);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setRows(data ?? []);
  }

  const filteredRows = rows.filter((row) => {
    const text = `${row.guard?.full_name ?? ""} ${row.checkpoint?.code ?? ""} ${row.checkpoint?.name ?? ""} ${row.route?.name ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "all" || row.status === statusFilter);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Logs de Ronda</h1>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input className="input-field pl-9" placeholder="Pesquisar agente, checkpoint ou rota..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field md:max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos os estados</option>
          <option value="completed">Concluídos</option>
          <option value="late">Atrasados</option>
          <option value="out_of_sequence">Fora de sequência</option>
          <option value="missed">Perdidos</option>
        </select>
      </div>
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[#1e3a5f]">
              <th className="pb-3 pr-4">Agente</th>
              <th className="pb-3 pr-4">Rota</th>
              <th className="pb-3 pr-4">Checkpoint</th>
              <th className="pb-3 pr-4">Horário</th>
              <th className="pb-3 pr-4">Distância</th>
              <th className="pb-3 pr-4">GPS</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-b border-[#1e3a5f]/40">
                <td className="py-3 pr-4 text-white">{row.guard?.full_name ?? "—"}</td>
                <td className="py-3 pr-4 text-gray-300">{row.route?.name ?? "—"}</td>
                <td className="py-3 pr-4 font-mono text-teal-400">{row.checkpoint?.code} – {row.checkpoint?.name}</td>
                <td className="py-3 pr-4 text-xs text-gray-300">{formatDateTime(row.scanned_at)}</td>
                <td className="py-3 pr-4 text-gray-400">{row.gps_distance_meters != null ? `${row.gps_distance_meters}m` : "—"}</td>
                <td className="py-3 pr-4 text-xs">{statusLabel(row.gps_status ?? "")}</td>
                <td className="py-3 text-xs">{statusLabel(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="text-gray-500 text-center py-8">Nenhum log encontrado</p>}
      </div>
    </div>
  );
}
