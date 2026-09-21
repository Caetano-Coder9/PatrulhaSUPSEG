"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/offline/db";
import {
  enqueuePatrolLog,
  completeQueuedPatrolSession,
  createClientEventId,
} from "@/lib/offline/sync";
import { validateGps, getCurrentPosition } from "@/lib/utils/geo";
import {
  CheckCircle2,
  XCircle,
  MapPin,
  Loader2,
  Camera,
  Flag,
  AlertTriangle,
} from "lucide-react";
import type { LocalPatrolLog, GpsStatus, LogStatus } from "@/lib/types";

type ScanResult = {
  success: boolean;
  message: string;
  gpsStatus?: GpsStatus;
  distance?: number | null;
  checkpointName?: string;
  allDone?: boolean;
  diagnostic?: {
    qrFound: boolean;
    qrExpected: boolean;
    currentCheckpoint: string;
    receivedCheckpoint: string;
    checkpointStatusAfter: string;
    gpsValid: boolean | null;
    gpsAccuracy: number | null;
    gpsDistance: number | null;
    gpsRadius: number | null;
    targetLat: number | null;
    targetLng: number | null;
    currentLat: number | null;
    currentLng: number | null;
    reason?: string;
  };
};

export default function ScanPage() {
  const router = useRouter();
  const [active, setActive] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
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
    if (!ar[0]) return;

    const localRoute = ar[0];
    if (localRoute.status === "completed") {
      setActive(localRoute);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && localRoute.guardId && localRoute.guardId !== user.id) {
        return;
      }

      if (user) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("location_id")
          .eq("id", user.id)
          .single();

        if (
          currentProfile?.location_id &&
          localRoute.locationId !== currentProfile.location_id
        ) {
          return;
        }
      }
    } catch {
      // Ignora erro de rede para manter suporte offline
    }

    setActive(localRoute);
  }

  async function handleFinishPatrol() {
    if (!active || finishing) return;
    setFinishing(true);

    try {
      const completedAt = new Date().toISOString();
      const finishedActive = {
        ...active,
        status: "completed" as const,
        completedAt,
      };

      // 1. Atualiza no Supabase se online
      if (navigator.onLine && active.sessionId) {
        try {
          const { error: sessionError } = await supabase
            .from("patrol_sessions")
            .update({ status: "completed", completed_at: completedAt })
            .eq("id", active.sessionId);
          if (sessionError) {
            console.warn("Aviso ao atualizar sessão online:", sessionError.message);
          }
        } catch (err) {
          console.warn("Erro de conexão ao atualizar sessão:", err);
        }
      }

      // 2. Garante registro na fila offline
      await completeQueuedPatrolSession(finishedActive);

      // 3. Persiste a conclusão localmente
      if (db && active.id) {
        await db.activeRoute.put(finishedActive);
      }

      setActive(finishedActive);
      setShowFinishConfirm(false);

      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (err) {
      console.error("Falha ao finalizar ronda:", err);
    } finally {
      setFinishing(false);
    }
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

    if (active.status === "completed") {
      setResult({ success: true, message: "Esta ronda já foi concluída." });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const guardId = user?.id || active.guardId;
    if (!guardId) {
      setResult({ success: false, message: "Sessão expirada. Faça login novamente." });
      return;
    }

    const normalizedToken = token.trim();
    const expected = active.checkpoints.find((c: any) => c.status === "pending");
    const currentCheckpoint = expected
      ? `${expected.code} (${expected.id})`
      : "Nenhum checkpoint pendente";

    // Encontra checkpoint pelo token único, código (ex: P01), UUID ou substring
    const cp = active.checkpoints.find((c: any) => {
      if (c.qr_code_token && c.qr_code_token.toLowerCase() === normalizedToken.toLowerCase()) return true;
      if (c.code && c.code.toLowerCase() === normalizedToken.toLowerCase()) return true;
      if (c.id && c.id.toLowerCase() === normalizedToken.toLowerCase()) return true;
      if (c.qr_code_token && normalizedToken.includes(c.qr_code_token)) return true;
      return false;
    });

    if (!cp) {
      setResult({
        success: false,
        message: `QR Code não pertence à rota atual (${normalizedToken}).`,
        diagnostic: {
          qrFound: false,
          qrExpected: false,
          currentCheckpoint,
          receivedCheckpoint: `Não encontrado (${normalizedToken})`,
          checkpointStatusAfter: "Sem alteração",
          gpsValid: null,
          gpsAccuracy: null,
          gpsDistance: null,
          gpsRadius: null,
          targetLat: null,
          targetLng: null,
          currentLat: null,
          currentLng: null,
          reason: "QR Code não encontrado entre os checkpoints da rota ativa.",
        },
      });
      return;
    }

    const qrExpected = expected?.id === cp.id;

    if (cp.status === "scanned" || cp.status === "out_of_sequence") {
      setResult({
        success: false,
        message: `Checkpoint ${cp.code} (${cp.name}) já foi escaneado nesta ronda.`,
        checkpointName: cp.name,
        diagnostic: {
          qrFound: true,
          qrExpected,
          currentCheckpoint,
          receivedCheckpoint: `${cp.code} (${cp.id})`,
          checkpointStatusAfter: cp.status,
          gpsValid: null,
          gpsAccuracy: null,
          gpsDistance: null,
          gpsRadius: cp.gps_radius_meters,
          targetLat: cp.target_lat,
          targetLng: cp.target_lng,
          currentLat: null,
          currentLng: null,
          reason: "Checkpoint já processado anteriormente nesta ronda.",
        },
      });
      return;
    }

    // Sequência
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
      guard_id: guardId,
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

    // Atualiza estado da rota: o checkpoint escaneado passa a ser "scanned" ou "out_of_sequence"
    const newCheckpointStatus = logStatus === "out_of_sequence" ? "out_of_sequence" : "scanned";
    const updatedCheckpoints = active.checkpoints.map((c: any) =>
      c.id === cp.id
        ? {
            ...c,
            status: newCheckpointStatus,
            scanned_at: log.scanned_at,
          }
        : c
    );

    const allCheckpointsDone = updatedCheckpoints.every(
      (checkpoint: any) =>
        checkpoint.status === "scanned" || checkpoint.status === "out_of_sequence"
    );

    const newActive = {
      ...active,
      checkpoints: updatedCheckpoints,
    };

    const diagnostic = {
      qrFound: true,
      qrExpected,
      currentCheckpoint,
      receivedCheckpoint: `${cp.code} (${cp.id})`,
      checkpointStatusAfter: newCheckpointStatus,
      gpsValid: gpsResult.isValid,
      gpsAccuracy: accuracy,
      gpsDistance: gpsResult.distanceMeters,
      gpsRadius: cp.gps_radius_meters,
      targetLat: cp.target_lat,
      targetLng: cp.target_lng,
      currentLat: scannedLat,
      currentLng: scannedLng,
      reason:
        logStatus === "out_of_sequence"
          ? "QR escaneado fora da ordem sequencial (registrado para auditoria)."
          : !gpsResult.isValid
            ? `QR válido; GPS ${gpsResult.status} registrado para auditoria.`
            : allCheckpointsDone
              ? "Último checkpoint concluído! Todos os pontos da rota foram escaneados."
              : "Checkpoint concluído com sucesso.",
    };

    // Atualiza a UI imediatamente
    setActive(newActive);

    // Persistência local e fila em segundo plano
    void (async () => {
      await enqueuePatrolLog(log);
      if (db && active.id) {
        await db.activeRoute.put(newActive);
      }
    })().catch((error) => {
      console.error("Falha ao persistir o resultado do scan", error);
    });

    // Feedback háptico
    if (navigator.vibrate) {
      navigator.vibrate(gpsResult.isValid ? [30, 50, 30] : [50, 30, 50]);
    }

    const scanMessage = allCheckpointsDone
      ? `Checkpoint ${cp.code} – ${cp.name} registrado! Todos os checkpoints foram escaneados.`
      : logStatus === "out_of_sequence"
        ? `Registrado fora de sequência: ${cp.code} – ${cp.name}`
        : `Checkpoint ${cp.code} – ${cp.name} registrado com sucesso!`;

    setResult({
      success: true,
      message: scanMessage,
      gpsStatus: gpsResult.status,
      distance: gpsResult.distanceMeters,
      checkpointName: cp.name,
      allDone: allCheckpointsDone,
      diagnostic,
    });
  }

  // Tela de Ronda Concluída
  if (active?.status === "completed") {
    const scannedTotal = (active.checkpoints ?? []).filter(
      (c: any) => c.status === "scanned" || c.status === "out_of_sequence"
    ).length;
    const totalPts = (active.checkpoints ?? []).length;

    return (
      <div className="p-6 text-center space-y-6 my-auto max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto shadow-lg shadow-green-900/30">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Ronda Concluída!</h1>
          <p className="text-gray-400 text-sm mt-1">{active.routeName}</p>
        </div>

        <div className="card text-left space-y-2.5 text-xs text-gray-300">
          <div className="flex justify-between py-1 border-b border-[#1e3a5f]">
            <span className="text-gray-400">Posto:</span>
            <span className="font-semibold text-white">{active.locationName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#1e3a5f]">
            <span className="text-gray-400">Checkpoints:</span>
            <span className="font-semibold text-teal-400">
              {scannedTotal} de {totalPts} registrados
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-[#1e3a5f]">
            <span className="text-gray-400">Início:</span>
            <span className="text-gray-300">
              {active.startedAt
                ? new Date(active.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Término:</span>
            <span className="text-gray-300">
              {active.completedAt
                ? new Date(active.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          </div>
        </div>

        <button
          className="btn-primary w-full py-3.5 text-base font-semibold"
          onClick={async () => {
            if (db && active?.id) await db.activeRoute.delete(active.id);
            setActive(null);
            router.push("/mobile/home");
          }}
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="p-6 text-center space-y-4">
        <Camera className="w-12 h-12 text-gray-600 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Nenhuma ronda em andamento</h2>
        <p className="text-gray-400 text-sm">
          Acesse o menu Início para selecionar e iniciar uma rota atribuída ao seu posto.
        </p>
        <button
          className="btn-primary"
          onClick={() => router.push("/mobile/home")}
        >
          Ir para Início
        </button>
      </div>
    );
  }

  const nextPending = active.checkpoints.find((c: any) => c.status === "pending");
  const scannedCount = active.checkpoints.filter(
    (c: any) => c.status === "scanned" || c.status === "out_of_sequence"
  ).length;
  const totalCount = active.checkpoints.length;
  const isAllScanned = totalCount > 0 && scannedCount === totalCount;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Escanear checkpoint</h1>
        <div className="flex items-center justify-between text-gray-400 text-sm mt-0.5">
          <span>{active.routeName}</span>
          <span className="text-xs text-teal-400 font-medium">
            {scannedCount} de {totalCount} concluídos
          </span>
        </div>
      </div>

      {/* Cartão de Ronda Pronta para Terminar */}
      {isAllScanned && (
        <div className="card border-2 border-teal-500 bg-teal-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-teal-300 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
            <span>Todos os checkpoints escaneados!</span>
          </div>
          <p className="text-xs text-gray-300">
            Você registrou todos os {totalCount} pontos de controle da rota. Conclua a ronda para enviar o relatório final.
          </p>
          <button
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base font-bold bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-900/50"
            onClick={handleFinishPatrol}
            disabled={finishing}
          >
            {finishing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            Terminar Ronda
          </button>
        </div>
      )}

      {nextPending && !isAllScanned && (
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
            <button
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={startScanner}
            >
              <Camera className="w-5 h-5" /> Abrir câmera
            </button>
          </div>
        )}
        {processing && (
          <div className="p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            <span className="text-sm text-gray-300">Validando leitura...</span>
          </div>
        )}
      </div>

      {/* Resultado do Scan */}
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
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white">{result.message}</div>
              {result.gpsStatus && (
                <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS: {result.gpsStatus}
                  {result.distance != null && ` · ${result.distance}m`}
                </div>
              )}
              {result.diagnostic && (
                <div className="mt-3 space-y-1 text-xs text-gray-300 border-t border-[#1e3a5f] pt-3">
                  <div>QR encontrado: <strong>{result.diagnostic.qrFound ? "SIM" : "NÃO"}</strong></div>
                  <div>QR esperado: <strong>{result.diagnostic.qrExpected ? "SIM" : "NÃO"}</strong></div>
                  <div>Checkpoint esperado: {result.diagnostic.currentCheckpoint}</div>
                  <div>Checkpoint recebido: {result.diagnostic.receivedCheckpoint}</div>
                  <div>Status após scan: <strong>{result.diagnostic.checkpointStatusAfter}</strong></div>
                  <div>GPS válido: <strong>{result.diagnostic.gpsValid == null ? "NÃO AVALIADO" : result.diagnostic.gpsValid ? "SIM" : "NÃO"}</strong></div>
                  <div>Precisão GPS: <strong>{result.diagnostic.gpsAccuracy == null ? "—" : `${result.diagnostic.gpsAccuracy}m`}</strong></div>
                  <div>Distância do ponto: {result.diagnostic.gpsDistance ?? "—"}m (raio: {result.diagnostic.gpsRadius ?? "—"}m)</div>
                  {result.diagnostic.reason && <div>Nota: {result.diagnostic.reason}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação no Card de Resultado */}
          {result.success && isAllScanned && (
            <button
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3.5 text-base font-bold bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-900/50"
              onClick={handleFinishPatrol}
              disabled={finishing}
            >
              {finishing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              Terminar Ronda
            </button>
          )}

          {result.success && !isAllScanned && (
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

      {/* Lista da rota e Progresso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          <span>Progresso da ronda</span>
          <span>{scannedCount}/{totalCount}</span>
        </div>
        {active.checkpoints.map((cp: any) => {
          const isDone = cp.status === "scanned" || cp.status === "out_of_sequence";
          return (
            <div
              key={cp.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                isDone
                  ? "bg-[#0f2744]/80 border-teal-900/50"
                  : "bg-[#0f2744]/40 border-transparent"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${
                    cp.status === "pending" ? "text-gray-400" : "text-white"
                  }`}
                >
                  {cp.code} – {cp.name}
                </div>
                {cp.status === "out_of_sequence" && (
                  <div className="text-[10px] text-orange-400">Fora de sequência</div>
                )}
                {cp.scanned_at && (
                  <div className="text-[10px] text-gray-500">
                    Escaneado às {new Date(cp.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ação para Terminar / Encerrar Ronda */}
      <div className="pt-2 pb-6 space-y-2">
        {isAllScanned ? (
          <button
            type="button"
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base font-bold bg-teal-600 hover:bg-teal-500"
            onClick={handleFinishPatrol}
            disabled={finishing}
          >
            {finishing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            Terminar Ronda
          </button>
        ) : (
          <button
            type="button"
            className="w-full text-center py-2.5 text-xs text-gray-400 hover:text-red-300 border border-[#1e3a5f] hover:border-red-800/50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            onClick={() => setShowFinishConfirm(true)}
            disabled={finishing}
          >
            <Flag className="w-3.5 h-3.5 text-gray-500" />
            Encerrar ronda ({scannedCount}/{totalCount} concluídos)
          </button>
        )}
      </div>

      {/* Modal de Confirmação de Término */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-4 border-teal-700/60 p-6">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              Finalizar Ronda?
            </div>
            <p className="text-sm text-gray-300">
              {isAllScanned
                ? "Todos os checkpoints foram concluídos. Deseja finalizar e registrar a conclusão da ronda?"
                : `Atenção: apenas ${scannedCount} de ${totalCount} checkpoints foram escaneados. Deseja encerrar a ronda mesmo com pontos pendentes?`}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-sm"
                onClick={handleFinishPatrol}
                disabled={finishing}
              >
                {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sim, terminar
              </button>
              <button
                className="btn-secondary flex-1 py-3 text-sm"
                onClick={() => setShowFinishConfirm(false)}
                disabled={finishing}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
