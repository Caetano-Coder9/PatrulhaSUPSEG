"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Pencil, Plus, Power, Printer, QrCode, Search, X } from "lucide-react";
import type { Checkpoint, Location } from "@/lib/types";

export default function CheckpointsPage() {
  const supabase = createClient();
  const [checkpoints, setCheckpoints] = useState<(Checkpoint & { location?: Location })[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printItem, setPrintItem] = useState<(Checkpoint & { location?: Location }) | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    location_id: "",
    target_lat: "",
    target_lng: "",
    gps_radius_meters: "30",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data: cps, error: checkpointsError }, { data: locs, error: locationsError }] = await Promise.all([
      supabase
        .from("checkpoints")
        .select("*, location:locations(*)")
        .order("code"),
      supabase.from("locations").select("*").eq("is_active", true),
    ]);
    if (checkpointsError || locationsError) {
      setError((checkpointsError ?? locationsError)?.message ?? "Não foi possível carregar os dados.");
      return;
    }
    setError(null);
    setCheckpoints((cps as any) ?? []);
    setLocations(locs ?? []);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", location_id: "", target_lat: "", target_lng: "", gps_radius_meters: "30" });
    setShowForm(true);
  }

  function openEdit(cp: Checkpoint) {
    setEditingId(cp.id);
    setForm({
      code: cp.code,
      name: cp.name,
      location_id: cp.location_id,
      target_lat: cp.target_lat?.toString() ?? "",
      target_lng: cp.target_lng?.toString() ?? "",
      gps_radius_meters: cp.gps_radius_meters.toString(),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function saveCheckpoint(e: React.FormEvent) {
    e.preventDefault();
    const values = {
      code: form.code.toUpperCase(),
      name: form.name,
      location_id: form.location_id,
      target_lat: form.target_lat ? parseFloat(form.target_lat) : null,
      target_lng: form.target_lng ? parseFloat(form.target_lng) : null,
      gps_radius_meters: parseInt(form.gps_radius_meters) || 30,
    };
    const result = editingId
      ? await supabase.from("checkpoints").update(values).eq("id", editingId)
      : await supabase.from("checkpoints").insert(values);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    closeForm();
    load();
  }

  async function toggleActive(cp: Checkpoint) {
    const { error: updateError } = await supabase
      .from("checkpoints")
      .update({ is_active: !cp.is_active })
      .eq("id", cp.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  const filteredCheckpoints = checkpoints.filter((cp) =>
    `${cp.code} ${cp.name} ${cp.location?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Checkpoints</h1>
          <p className="text-gray-400 text-sm mt-1">Pontos de controle com QR Code e GPS</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          className="input-field pl-9"
          placeholder="Pesquisar checkpoints..."
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
        <form onSubmit={saveCheckpoint} className="card space-y-4 max-w-lg">
          <h3 className="font-semibold text-white">{editingId ? "Editar checkpoint" : "Novo checkpoint"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Código</label>
              <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="P01" required />
            </div>
            <div>
              <label className="text-xs text-gray-400">Raio GPS (m)</label>
              <input className="input-field" type="number" value={form.gps_radius_meters} onChange={(e) => setForm({ ...form, gps_radius_meters: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400">Nome</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs text-gray-400">Posto</label>
            <select className="input-field" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} required>
              <option value="">Selecione...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Latitude</label>
              <input className="input-field" value={form.target_lat} onChange={(e) => setForm({ ...form, target_lat: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-400">Longitude</label>
              <input className="input-field" value={form.target_lng} onChange={(e) => setForm({ ...form, target_lng: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCheckpoints.map((cp) => (
          <div key={cp.id} className={`card ${!cp.is_active ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-teal-400 font-bold">{cp.code}</div>
                <div className="text-white font-medium mt-0.5">{cp.name}</div>
                <div className="text-xs text-gray-400 mt-1">{(cp as any).location?.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${cp.is_active ? "bg-green-900/50 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                  {cp.is_active ? "Ativo" : "Inativo"}
                </span>
                <QrCode className="w-5 h-5 text-gray-500" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Raio: {cp.gps_radius_meters}m · Token: {cp.qr_code_token.slice(0, 12)}…
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn-secondary text-sm flex items-center justify-center gap-2 py-2" onClick={() => openEdit(cp)}>
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button className="btn-secondary text-sm flex items-center justify-center gap-2 py-2" onClick={() => toggleActive(cp)}>
                <Power className="w-4 h-4" /> {cp.is_active ? "Desativar" : "Ativar"}
              </button>
              <button
                className="btn-secondary col-span-2 text-sm flex items-center justify-center gap-2 py-2"
                onClick={() => setPrintItem(cp)}
              >
                <Printer className="w-4 h-4" /> Imprimir QR
              </button>
            </div>
          </div>
        ))}
        {filteredCheckpoints.length === 0 && <p className="text-gray-500">Nenhum checkpoint encontrado</p>}
      </div>

      {/* Print modal */}
      {printItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPrintItem(null)}>
          <div className="bg-white text-black rounded-2xl p-8 max-w-sm w-full text-center print:shadow-none" onClick={(e) => e.stopPropagation()} id="qr-print">
            <div className="text-sm font-semibold text-gray-600 mb-1">
              {(printItem as any).location?.name ?? "Posto"}
            </div>
            <div className="text-lg font-bold mb-4">
              CHECKPOINT: {printItem.code} – {printItem.name}
            </div>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={printItem.qr_code_token} size={200} level="H" />
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              Escaneie durante a ronda
            </div>
            <div className="mt-6 flex gap-2 print:hidden">
              <button className="btn-primary flex-1" onClick={() => window.print()}>Imprimir</button>
              <button className="btn-secondary flex-1" onClick={() => setPrintItem(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
