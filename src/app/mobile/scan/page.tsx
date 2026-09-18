"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/offline/db";
import {
  enqueuePatrolLog,
  createClientEventId,
} from "@/lib/offline/sync";
import { validateGps, getCurrentPosition } from "@/lib/utils/geo";
import { CheckCircle2, XCircle, MapPin, Loader2, Camera } from "lucide-react";
import type { LocalPatrolLog, GpsStatus, LogStatus } from "@/lib/types";

type ScanResult = {
  success: boolean;
  message: string;
  gpsStatus?: GpsStatus;
  distance?: number | null;
  checkpointName?: string;
};

export default function ScanPage() {
  const [active, setActive] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadActive();
    return () => {
      stopScanner();
    };
  }, []);

  async function loadActive() {
    if (!db) return;
    const ar = await db.activeRoute.toArray();
    if (ar[0]) setActive(ar[0]);
  }

  async function startScanner() {
    setResult(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      );
    } catch (err) {
      setResult({
        success: false,
        message: "Não foi possível acessar a câmera. Verifique as permissões.",
      });
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function onScanSuccess(decodedText: string) {
    if (processing) return;
    setProcessing(true);
    await stopScanner();

    // Feedback háptico
    if (navigator.vibrate) navigator.vibrate(50);

    try {
      await processScan(decodedText.trim());
    } finally {
      setProcessing(false);
    }
  }

  async function processScan(token: string) {
    if (!active) {
      setResult({ success: false, message: "Nenhuma ronda ativa. Inicie uma rota." });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setResult({ success: false, message: "Sessão expirada." });
      return;
    }

    // Encontra checkpoint pelo token na rota ativa
    const cp = active.checkpoints.find(
      (c: any) => c.qr_code_token === token
    );

    if (!cp) {
      // Tenta buscar no banco se online (checkpoint de outro posto?)
      setResult({
        success: false,
        message: "QR Code não pertence à rota atual ou é inválido.",
      });
      return;
    }

    if (cp.status === "scanned" || cp.status === "out_of_sequence") {
      setResult({
        success: false,
        message: `Checkpoint ${cp.code} já foi escaneado nesta ronda.`,
        checkpointName: cp.name,
      });
      return;
    }

    // Sequência
    const expected = active.checkpoints.find((c: any) => c.status === "pending");
    let logStatus: LogStatus = "completed";
    if (expected && expected.id !== cp.id) {
      logStatus = "out_of_sequence";
    }

    // GPS
    let scannedLat: number | null = null;
    let scannedLng: number | null = null;
    let accuracy: number | null = null;
    let gpsResult = validateGps(null, null, null, cp.target_lat, cp.target_lng, cp.gps_radius_meters);

    try {
      const pos = await getCurrentPosition();
      scannedLat = pos.coords.latitude;
      scannedLng = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
      gpsResult = validateGps(
        scannedLat,
        scannedLng,
        accuracy,
        cp.target_lat,
        cp.target_lng,
        cp.gps_radius_meters
      );
    } catch (e: any) {
      if (e?.code === 1) {
        gpsResult = {
          isValid: false,
          distanceMeters: null,
          accuracyMeters: null,
          status: "permission_denied",
        };
      } else {
        gpsResult = {
          isValid: false,
          distanceMeters: null,
          accuracyMeters: null,
          status: "unavailable",
        };
      }
    }

    const clientEventId = createClientEventId();
    const log: LocalPatrolLog = {
      client_event_id: clientEventId,
      patrol_session_id: active.sessionId ?? undefined,
      route_id: active.routeId,
      guard_id: user.id,
      checkpoint_id: cp.id,
      checkpoint_code: cp.code,
      checkpoint_name: cp.name,
      scanned_at: new Date().toISOString(),
      scanned_lat: scannedLat ?? undefined,
      scanned_lng: scannedLng ?? undefined,
      gps_accuracy_meters: accuracy ?? undefined,
      gps_distance_meters: gpsResult.distanceMeters ?? undefined,
      is_gps_valid: gpsResult.isValid,
      gps_status: gpsResult.status,
      status: logStatus,
      synced: false,
      created_at: new Date().toISOString(),
    };

    // Salva offline + fila
    await enqueuePatrolLog(log);

    // Atualiza estado da rota
    const updatedCheckpoints = active.checkpoints.map((c: any) =>
      c.id === cp.id
        ? {
            ...c,
            status: logStatus === "out_of_sequence" ? "out_of_sequence" : "scanned",
            scanned_at: log.scanned_at,
          }
        : c
    );
    const newActive = { ...active, checkpoints: updatedCheckpoints };
    if (db) await db.activeRoute.put(newActive);
    setActive(newActive);

    // Feedback
    if (navigator.vibrate) {
      navigator.vibrate(gpsResult.isValid ? [30, 50, 30] : [100, 50, 100]);
    }

    setResult({
      success: true,
      message:
        logStatus === "out_of_sequence"
          ? `Registrado fora de sequência: ${cp.code} – ${cp.name}`
          : `Checkpoint ${cp.code} – ${cp.name} registrado!`,
      gpsStatus: gpsResult.status,
      distance: gpsResult.distanceMeters,
      checkpointName: cp.name,
    });
  }

  if (!active) {
    return (
      <div className="p-6 text-center space-y-4">
        <Camera className="w-12 h-12 text-gray-600 mx-auto" />
        <p className="text-gray-400">Inicie uma ronda na tela Início para escanear.</p>
      </div>
    );
  }

  const nextPending = active.checkpoints.find((c: any) => c.status === "pending");

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Escanear checkpoint</h1>
        <p className="text-gray-400 text-sm mt-0.5">{active.routeName}</p>
      </div>

      {nextPending && (
        <div className="card border-teal-700/40">
          <div className="text-xs text-teal-400 font-medium">Próximo esperado</div>
          <div className="text-white font-semibold mt-0.5">
            {nextPending.code} – {nextPending.name}
          </div>
        </div>
      )}

      {/* Scanner area */}
      <div className="card overflow-hidden p-0">
        <div id="qr-reader" className="w-full min-h-[280px] bg-black rounded-2xl overflow-hidden" />
        {!scanning && !processing && (
          <div className="p-4">
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={startScanner}>
              <Camera className="w-5 h-5" /> Abrir câmera
            </button>
          </div>
        )}
        {processing && (
          <div className="p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <span className="text-sm text-gray-300">Validando...</span>
          </div>
        )}
      </div>

      {result && (
        <div
          className={`card border ${
            result.success ? "border-green-700/50" : "border-red-700/50"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 shrink-0" />
            )}
            <div>
              <div className="font-medium text-white">{result.message}</div>
              {result.gpsStatus && (
                <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS: {result.gpsStatus}
                  {result.distance != null && ` · ${result.distance}m`}
                </div>
              )}
            </div>
          </div>
          {result.success && (
            <button className="btn-primary w-full mt-4" onClick={startScanner}>
              Escanear próximo
            </button>
          )}
          {!result.success && (
            <button className="btn-secondary w-full mt-4" onClick={() => setResult(null)}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Lista da rota */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          Progresso da ronda
        </div>
        {active.checkpoints.map((cp: any) => (
          <div
            key={cp.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0f2744]/60"
          >
            {cp.status === "scanned" || cp.status === "out_of_sequence" ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
            )}
            <div className="flex-1">
              <div className={`text-sm font-medium ${cp.status === "pending" ? "text-gray-400" : "text-white"}`}>
                {cp.code} – {cp.name}
              </div>
              {cp.status === "out_of_sequence" && (
                <div className="text-[10px] text-orange-400">Fora de sequência</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
