"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/offline/db";
import { enqueueIncident, createClientEventId } from "@/lib/offline/sync";
import { Camera, Send, CheckCircle2 } from "lucide-react";
import type { IncidentSeverity } from "@/lib/types";

export default function IncidentPage() {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [checkpointId, setCheckpointId] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCheckpoints();
  }, []);

  async function loadCheckpoints() {
    if (db) {
      const ar = await db.activeRoute.toArray();
      if (ar[0]) {
        setCheckpoints(ar[0].checkpoints);
        return;
      }
    }
    const { data } = await supabase
      .from("checkpoints")
      .select("id, code, name")
      .eq("is_active", true)
      .order("code");
    setCheckpoints(data ?? []);
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }

    let locationId: string | undefined;
    if (db) {
      const ar = await db.activeRoute.toArray();
      locationId = ar[0]?.locationId;
    }

    const clientEventId = createClientEventId();
    await enqueueIncident({
      client_event_id: clientEventId,
      guard_id: user.id,
      location_id: locationId,
      checkpoint_id: checkpointId || undefined,
      title,
      description: description || undefined,
      photo_blob: photo ?? undefined,
      photo_local_url: photoPreview ?? undefined,
      severity,
      status: "open",
      reported_at: new Date().toISOString(),
      synced: false,
      created_at: new Date().toISOString(),
    });

    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    setDone(true);
    setSending(false);
    setTitle("");
    setDescription("");
    setPhoto(null);
    setPhotoPreview(null);
    setCheckpointId("");
  }

  if (done) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-400" />
        <h2 className="text-xl font-bold text-white">Ocorrência registrada</h2>
        <p className="text-gray-400 text-sm text-center">
          Será sincronizada automaticamente quando houver conexão.
        </p>
        <button className="btn-primary mt-4" onClick={() => setDone(false)}>
          Nova ocorrência
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Reportar ocorrência</h1>
        <p className="text-gray-400 text-sm">Funciona offline</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs text-gray-400">Título *</label>
          <input
            className="input-field mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ex: Porta entreaberta"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Checkpoint (opcional)</label>
          <select
            className="input-field mt-1"
            value={checkpointId}
            onChange={(e) => setCheckpointId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {checkpoints.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} – {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400">Severidade</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(["low", "medium", "high"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`py-3 rounded-xl text-sm font-medium border transition-colors ${
                  severity === s
                    ? s === "high"
                      ? "bg-red-900/50 border-red-600 text-red-300"
                      : s === "medium"
                      ? "bg-yellow-900/50 border-yellow-600 text-yellow-300"
                      : "bg-blue-900/50 border-blue-600 text-blue-300"
                    : "bg-[#0f2744] border-[#1e3a5f] text-gray-400"
                }`}
              >
                {s === "low" ? "Baixa" : s === "medium" ? "Média" : "Alta"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Descrição</label>
          <textarea
            className="input-field mt-1 min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes da ocorrência..."
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Foto</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoChange}
          />
          <button
            type="button"
            className="btn-secondary w-full mt-1 flex items-center justify-center gap-2"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="w-5 h-5" />
            {photo ? "Trocar foto" : "Capturar foto"}
          </button>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="mt-3 rounded-xl w-full max-h-48 object-cover"
            />
          )}
        </div>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={sending || !title}>
          <Send className="w-5 h-5" />
          {sending ? "Salvando..." : "Registrar ocorrência"}
        </button>
      </form>
    </div>
  );
}
