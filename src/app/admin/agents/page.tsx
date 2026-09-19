"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Power, Search, X } from "lucide-react";
import type { Location } from "@/lib/types";

export default function AgentsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ phone_number: "", shift_info: "", location_id: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data, error: profileError }, { data: locationData, error: locationError }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("locations").select("*").eq("is_active", true).order("name"),
    ]);
    if (profileError || locationError) {
      setError(profileError?.message ?? locationError?.message ?? "Não foi possível carregar os dados.");
      return;
    }
    setError(null);
    setRows(data ?? []);
    setLocations((locationData as Location[]) ?? []);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({ phone_number: row.phone_number ?? "", shift_info: row.shift_info ?? "", location_id: row.location_id ?? "" });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        phone_number: form.phone_number || null,
        shift_info: form.shift_info || null,
        location_id: form.location_id || null,
      })
      .eq("id", editing.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(null);
    load();
  }

  async function toggleActive(row: any) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  const filteredRows = rows.filter((row) =>
    `${row.full_name} ${row.email} ${row.phone_number ?? ""} ${row.shift_info ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Agentes</h1>
      <p className="text-sm text-gray-400">
        Usuários são criados no Supabase Auth. O profile é gerado automaticamente.
      </p>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input-field pl-9" placeholder="Pesquisar agentes..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro"><X className="w-4 h-4" /></button>
        </div>
      )}
      {editing && (
        <form onSubmit={saveEdit} className="card space-y-3 max-w-md">
          <h2 className="font-semibold text-white">Editar perfil: {editing.full_name}</h2>
          <input className="input-field" placeholder="Telefone" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
          <input className="input-field" placeholder="Turno" value={form.shift_info} onChange={(e) => setForm({ ...form, shift_info: e.target.value })} />
          <select className="input-field" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })}>
            <option value="">Sem posto atribuído</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
          <div className="flex gap-2"><button className="btn-primary" type="submit">Salvar</button><button className="btn-secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button></div>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[#1e3a5f]">
              <th className="pb-3 pr-4">Nome</th>
              <th className="pb-3 pr-4">E-mail</th>
              <th className="pb-3 pr-4">Função</th>
              <th className="pb-3 pr-4">Telefone</th>
              <th className="pb-3 pr-4">Posto</th>
              <th className="pb-3">Turno</th>
              <th className="pb-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-[#1e3a5f]/40">
                <td className="py-3 pr-4 font-medium text-white">{r.full_name}</td>
                <td className="py-3 pr-4 text-gray-300">{r.email}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${r.role === "admin" ? "bg-purple-900/50 text-purple-300" : "bg-teal-900/50 text-teal-300"}`}>
                    {r.role}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400">{r.phone_number ?? "—"}</td>
                <td className="py-3 pr-4 text-gray-400">
                  {locations.find((location) => location.id === r.location_id)?.name ?? "Sem posto atribuído"}
                </td>
                <td className="py-3 text-gray-400">{r.shift_info ?? "—"}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button className="text-gray-400 hover:text-white" onClick={() => openEdit(r)} aria-label="Editar agente"><Pencil className="w-4 h-4" /></button>
                    <button className="text-gray-400 hover:text-white" onClick={() => toggleActive(r)} aria-label={r.is_active ? "Desativar agente" : "Ativar agente"}><Power className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="text-gray-500 text-center py-8">Nenhum agente encontrado</p>}
      </div>
    </div>
  );
}
