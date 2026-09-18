"use client";

import { useEffect, useState } from "react";
import { processSyncQueue, getPendingCount, isOnline } from "@/lib/offline/sync";
import { getMeta } from "@/lib/offline/db";
import { RefreshCw, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";

export default function SyncPage() {
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    refresh();
    setOnline(isOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function refresh() {
    setPending(await getPendingCount());
    setLastSync(await getMeta("last_sync_at"));
  }

  async function syncNow() {
    if (!isOnline()) {
      setLog((l) => ["Sem conexão. Aguarde a rede.", ...l]);
      return;
    }
    setSyncing(true);
    setLog([]);
    const { synced, failed } = await processSyncQueue((msg) =>
      setLog((l) => [msg, ...l].slice(0, 20))
    );
    setLog((l) => [`Concluído: ${synced} ok, ${failed} falha(s)`, ...l]);
    await refresh();
    setSyncing(false);
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Sincronização</h1>
        <p className="text-gray-400 text-sm">Fila offline → servidor</p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Status da rede</span>
          {online ? (
            <span className="flex items-center gap-1.5 text-green-400 text-sm">
              <Wifi className="w-4 h-4" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400 text-sm">
              <WifiOff className="w-4 h-4" /> Offline
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Registros pendentes</span>
          <span className={`text-lg font-bold ${pending > 0 ? "text-yellow-400" : "text-green-400"}`}>
            {pending}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Última sincronização</span>
          <span className="text-gray-300">
            {lastSync ? formatDateTime(lastSync) : "—"}
          </span>
        </div>
      </div>

      <button
        className="btn-primary w-full flex items-center justify-center gap-2"
        onClick={syncNow}
        disabled={syncing || !online}
      >
        <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando..." : "Sincronizar agora"}
      </button>

      {pending === 0 && !syncing && (
        <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4" /> Tudo sincronizado
        </div>
      )}

      {log.length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold text-gray-400 mb-2">Log</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i} className="text-xs text-gray-300 font-mono">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
