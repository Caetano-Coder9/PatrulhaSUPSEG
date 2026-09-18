"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Plus, Power, Search, X } from "lucide-react";

export default function LocationsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: queryError } = await supabase.from("locations").select("*").order("name");
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setRows(data ?? []);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", address: "", latitude: "", longitude: "" });
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      address: row.address ?? "",
      latitude: row.latitude?.toString() ?? "",
      longitude: row.longitude?.toString() ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const values = {
      name: form.name,
      address: form.address || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };
    const result = editingId
      ? await supabase.from("locations").update(values).eq("id", editingId)
      : await supabase.from("locations").insert(values);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    closeForm();
    load();
  }

  async function toggleActive(row: any) {
    const { error: updateError } = await supabase
      .from("locations")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  const filteredRows = rows.filter((row) =>
    `${row.name} ${row.address ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Postos</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo posto
        </button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          className="input-field pl-9"
          placeholder="Pesquisar postos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {showForm && (
        <form onSubmit={save} className="card space-y-3 max-w-md">
          <h2 className="font-semibold text-white">{editingId ? "Editar posto" : "Novo posto"}</h2>
          <input className="input-field" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input-field" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <input className="input-field" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredRows.map((r) => (
          <div key={r.id} className={`card ${!r.is_active ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-white">{r.name}</div>
              <span className={`status-badge ${r.is_active ? "bg-green-900/50 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                {r.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-1">{r.address ?? "—"}</div>
            <div className="text-xs text-gray-500 mt-2">
              {r.latitude != null && ` · ${r.latitude.toFixed(4)}, ${r.longitude?.toFixed(4)}`}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-sm" onClick={() => openEdit(r)}>
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-sm" onClick={() => toggleActive(r)}>
                <Power className="w-4 h-4" /> {r.is_active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
        {filteredRows.length === 0 && <p className="text-gray-500">Nenhum posto encontrado</p>}
      </div>
    </div>
  );
}
