"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RouteRow = {
  id: string;
  location_id: string;
  name: string;
  scheduled_time: string | null;
  tolerance_minutes: number;
  is_active: boolean;
  location?: { name: string };
  route_checkpoints?: Array<{ id: string; checkpoint_id: string; sequence_order: number; checkpoint?: { code: string; name: string } }>;
};

type Checkpoint = { id: string; code: string; name: string; location_id: string; is_active: boolean };

const emptyForm = {
  name: "",
  location_id: "",
  scheduled_time: "",
  tolerance_minutes: "15",
  checkpoint_ids: [] as string[],
};

export default function RoutesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: routeData, error: routeError }, { data: locationData, error: locationError }, { data: checkpointData, error: checkpointError }] = await Promise.all([
      supabase
        .from("patrol_routes")
        .select("*, location:locations(name), route_checkpoints(id, checkpoint_id, sequence_order, checkpoint:checkpoints(code, name))")
        .order("name"),
      supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
      supabase.from("checkpoints").select("id, code, name, location_id, is_active").eq("is_active", true).order("code"),
    ]);

    const loadError = routeError ?? locationError ?? checkpointError;
    if (loadError) {
      setError(loadError.message);
      return;
    }

    setError(null);
    setRows((routeData as RouteRow[]) ?? []);
    setLocations(locationData ?? []);
    setCheckpoints(checkpointData ?? []);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(route: RouteRow) {
    const selected = [...(route.route_checkpoints ?? [])]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((item) => item.checkpoint_id);
    setEditingId(route.id);
    setForm({
      name: route.name,
      location_id: route.location_id,
      scheduled_time: route.scheduled_time?.slice(0, 5) ?? "",
      tolerance_minutes: route.tolerance_minutes.toString(),
      checkpoint_ids: selected,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function toggleCheckpoint(id: string) {
    setForm((current) => ({
      ...current,
      checkpoint_ids: current.checkpoint_ids.includes(id)
        ? current.checkpoint_ids.filter((checkpointId) => checkpointId !== id)
        : [...current.checkpoint_ids, id],
    }));
  }

  function moveCheckpoint(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.checkpoint_ids.length) return;
    const checkpoint_ids = [...form.checkpoint_ids];
    [checkpoint_ids[index], checkpoint_ids[target]] = [checkpoint_ids[target], checkpoint_ids[index]];
    setForm((current) => ({ ...current, checkpoint_ids }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const values = {
      name: form.name,
      location_id: form.location_id,
      scheduled_time: form.scheduled_time || null,
      tolerance_minutes: parseInt(form.tolerance_minutes, 10) || 15,
    };
    const result = editingId
      ? await supabase.from("patrol_routes").update(values).eq("id", editingId).select("id").single()
      : await supabase.from("patrol_routes").insert(values).select("id").single();

    if (result.error || !result.data) {
      setError(result.error?.message ?? "Não foi possível salvar a rota.");
      return;
    }

    const routeId = result.data.id;
    const { error: deleteError } = await supabase.from("route_checkpoints").delete().eq("route_id", routeId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (form.checkpoint_ids.length > 0) {
      const { error: checkpointError } = await supabase.from("route_checkpoints").insert(
        form.checkpoint_ids.map((checkpoint_id, index) => ({
          route_id: routeId,
          checkpoint_id,
          sequence_order: index + 1,
        }))
      );
      if (checkpointError) {
        setError(checkpointError.message);
        return;
      }
    }

    closeForm();
    load();
  }

  async function toggleActive(route: RouteRow) {
    const { error: updateError } = await supabase
      .from("patrol_routes")
      .update({ is_active: !route.is_active })
      .eq("id", route.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  const filteredRows = rows.filter((route) =>
    `${route.name} ${route.location?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Rotas</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nova rota
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input className="input-field pl-9" placeholder="Pesquisar rotas..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar erro"><X className="w-4 h-4" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="card space-y-4 max-w-2xl">
          <h2 className="font-semibold text-white">{editingId ? "Editar rota" : "Nova rota"}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Nome da rota" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <select className="input-field" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} required>
              <option value="">Selecione o posto...</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <div><label className="text-xs text-gray-400">Horário</label><input className="input-field mt-1" type="time" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} /></div>
            <div><label className="text-xs text-gray-400">Tolerância (minutos)</label><input className="input-field mt-1" type="number" min="0" value={form.tolerance_minutes} onChange={(e) => setForm({ ...form, tolerance_minutes: e.target.value })} /></div>
          </div>

          <div>
            <div className="text-sm font-medium text-white mb-2">Checkpoints da rota</div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {checkpoints.map((checkpoint) => {
                const selectedIndex = form.checkpoint_ids.indexOf(checkpoint.id);
                const selected = selectedIndex >= 0;
                return (
                  <div key={checkpoint.id} className="flex items-center gap-2 text-sm bg-[#0f2744]/60 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={selected} onChange={() => toggleCheckpoint(checkpoint.id)} />
                    <span className="font-mono text-teal-400">{checkpoint.code}</span>
                    <span className="text-gray-300 flex-1">{checkpoint.name}</span>
                    {selected && <><span className="text-xs text-gray-500">#{selectedIndex + 1}</span><button type="button" className="text-gray-400 hover:text-white disabled:opacity-30" onClick={() => moveCheckpoint(selectedIndex, -1)} disabled={selectedIndex === 0} aria-label="Mover para cima"><ArrowUp className="w-4 h-4" /></button><button type="button" className="text-gray-400 hover:text-white disabled:opacity-30" onClick={() => moveCheckpoint(selectedIndex, 1)} disabled={selectedIndex === form.checkpoint_ids.length - 1} aria-label="Mover para baixo"><ArrowDown className="w-4 h-4" /></button></>}
                  </div>
                );
              })}
              {checkpoints.length === 0 && <p className="text-sm text-gray-500">Nenhum checkpoint ativo disponível.</p>}
            </div>
          </div>

          <div className="flex gap-2"><button type="submit" className="btn-primary">Salvar</button><button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button></div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {filteredRows.map((route) => (
          <div key={route.id} className={`card ${!route.is_active ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div className="font-semibold text-white">{route.name}</div><span className={`status-badge ${route.is_active ? "bg-green-900/50 text-green-300" : "bg-gray-700 text-gray-300"}`}>{route.is_active ? "Ativa" : "Inativa"}</span></div>
            <div className="text-sm text-gray-400 mt-1">{route.location?.name ?? "—"}</div>
            <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-3"><span>Horário: {route.scheduled_time?.slice(0, 5) ?? "—"}</span><span>Tolerância: {route.tolerance_minutes} min</span><span>{route.route_checkpoints?.length ?? 0} checkpoints</span></div>
            <div className="flex gap-2 mt-4"><button className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-sm" onClick={() => openEdit(route)}><Pencil className="w-4 h-4" /> Editar</button><button className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2 text-sm" onClick={() => toggleActive(route)}><Power className="w-4 h-4" /> {route.is_active ? "Desativar" : "Ativar"}</button></div>
          </div>
        ))}
        {filteredRows.length === 0 && <p className="text-gray-500">Nenhuma rota encontrada</p>}
      </div>
    </div>
  );
}
