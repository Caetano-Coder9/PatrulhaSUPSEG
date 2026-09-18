"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus } from "lucide-react";

export default function LocationsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("locations").select("*").order("name");
    setRows(data ?? []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("locations").insert({
      name: form.name,
      address: form.address || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    });
    setShowForm(false);
    setForm({ name: "", address: "", latitude: "", longitude: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Postos</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Novo posto
        </button>
      </div>
      {showForm && (
        <form onSubmit={create} className="card space-y-3 max-w-md">
          <input className="input-field" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input-field" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input-field" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <input className="input-field" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div className="font-semibold text-white">{r.name}</div>
            <div className="text-sm text-gray-400 mt-1">{r.address ?? "—"}</div>
            <div className="text-xs text-gray-500 mt-2">
              {r.is_active ? "Ativo" : "Inativo"}
              {r.latitude != null && ` · ${r.latitude.toFixed(4)}, ${r.longitude?.toFixed(4)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
