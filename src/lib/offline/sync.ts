"use client";

import { db, setMeta, getMeta } from "./db";
import { createClient } from "@/lib/supabase/client";
import type { ActiveRouteState, LocalPatrolLog, LocalIncident } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

let isSyncing = false;

export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

export async function enqueuePatrolLog(log: LocalPatrolLog) {
  if (!db) return;
  await db.patrolLogs.put(log);
  await db.syncQueue.add({
    entity_type: "patrol_log",
    client_event_id: log.client_event_id,
    operation: "insert",
    payload: { ...log },
    retry_count: 0,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function enqueuePatrolSession(session: ActiveRouteState, userId: string) {
  if (!db) return;
  await db.syncQueue.add({
    entity_type: "patrol_session",
    client_event_id: session.clientSessionId,
    operation: "insert",
    payload: {
      id: session.clientSessionId,
      route_id: session.routeId,
      guard_id: userId,
      location_id: session.locationId,
      started_at: session.startedAt,
      status: session.status,
      completed_at: session.completedAt ?? null,
    },
    retry_count: 0,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function completeQueuedPatrolSession(session: ActiveRouteState) {
  if (!db) return;
  const item = await db.syncQueue
    .where("client_event_id")
    .equals(session.clientSessionId)
    .first();
  if (!item) return;
  await db.syncQueue.update(item.id!, {
    payload: {
      ...item.payload,
      status: "completed",
      completed_at: session.completedAt ?? null,
    },
    status: "pending",
    updated_at: new Date().toISOString(),
  });
}

export async function enqueueIncident(incident: LocalIncident) {
  if (!db) return;
  await db.incidents.put(incident);
  await db.syncQueue.add({
    entity_type: "incident",
    client_event_id: incident.client_event_id,
    operation: "insert",
    payload: {
      ...incident,
      photo_blob: undefined, // blob tratado separadamente
      photo_local_url: undefined,
    },
    retry_count: 0,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getPendingCount(): Promise<number> {
  if (!db) return 0;
  return db.syncQueue.where("status").equals("pending").count();
}

export async function processSyncQueue(
  onProgress?: (msg: string) => void
): Promise<{ synced: number; failed: number }> {
  if (!db || isSyncing || !isOnline()) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  const supabase = createClient();
  let synced = 0;
  let failed = 0;

  try {
    const pending = await db.syncQueue
      .where("status")
      .equals("pending")
      .sortBy("created_at");

    for (const item of pending) {
      try {
        await db.syncQueue.update(item.id!, {
          status: "processing",
          updated_at: new Date().toISOString(),
        });

        if (item.entity_type === "patrol_session") {
          const payload = item.payload as {
            id: string;
            route_id: string;
            guard_id: string;
            location_id: string;
            started_at: string;
            status: string;
            completed_at: string | null;
          };
          const { error } = await supabase.from("patrol_sessions").upsert(
            {
              id: payload.id,
              route_id: payload.route_id,
              guard_id: payload.guard_id,
              location_id: payload.location_id,
              started_at: payload.started_at,
              status: payload.status,
              completed_at: payload.completed_at,
            },
            { onConflict: "id" }
          );
          if (error) throw error;

          const pendingLogs = await db.syncQueue
            .where("entity_type")
            .equals("patrol_log")
            .toArray();
          for (const pendingLog of pendingLogs) {
            const payload = pendingLog.payload as unknown as LocalPatrolLog;
            if (payload.patrol_session_id === undefined) {
              await db.syncQueue.update(pendingLog.id!, {
                payload: { ...pendingLog.payload, patrol_session_id: payload.patrol_session_id ?? item.client_event_id },
              });
            }
          }
        }

        if (item.entity_type === "patrol_log") {
          const payload = item.payload as unknown as LocalPatrolLog;
          const { error } = await supabase.from("patrol_logs").upsert(
            {
              client_event_id: payload.client_event_id,
              patrol_session_id: payload.patrol_session_id ?? null,
              route_id: payload.route_id ?? null,
              guard_id: payload.guard_id,
              checkpoint_id: payload.checkpoint_id,
              scanned_at: payload.scanned_at,
              scanned_lat: payload.scanned_lat ?? null,
              scanned_lng: payload.scanned_lng ?? null,
              gps_accuracy_meters: payload.gps_accuracy_meters ?? null,
              gps_distance_meters: payload.gps_distance_meters ?? null,
              is_gps_valid: payload.is_gps_valid,
              gps_status: payload.gps_status,
              status: payload.status,
              synced_offline: true,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "client_event_id", ignoreDuplicates: true }
          );

          if (error) throw error;

          await db.patrolLogs.update(payload.client_event_id, { synced: true });
        }

        if (item.entity_type === "incident") {
          const payload = item.payload as unknown as LocalIncident & {
            photo_blob?: Blob;
          };
          let photo_url: string | null = null;

          // Upload de foto se existir no local
          const local = await db.incidents.get(item.client_event_id);
          if (local?.photo_blob) {
            const path = `incidents/${payload.guard_id}/${item.client_event_id}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("incident-photos")
              .upload(path, local.photo_blob, {
                contentType: "image/jpeg",
                upsert: true,
              });
            if (!upErr) {
              const { data } = supabase.storage
                .from("incident-photos")
                .getPublicUrl(path);
              photo_url = data.publicUrl;
            }
          }

          const { error } = await supabase.from("incidents").upsert(
            {
              client_event_id: payload.client_event_id,
              guard_id: payload.guard_id,
              location_id: payload.location_id ?? null,
              checkpoint_id: payload.checkpoint_id ?? null,
              title: payload.title,
              description: payload.description ?? null,
              photo_url,
              severity: payload.severity,
              status: payload.status,
              reported_at: payload.reported_at,
              synced_offline: true,
            },
            { onConflict: "client_event_id", ignoreDuplicates: true }
          );

          if (error) throw error;
          await db.incidents.update(payload.client_event_id, { synced: true });
        }

        await db.syncQueue.update(item.id!, {
          status: "synced",
          updated_at: new Date().toISOString(),
        });
        synced++;
        onProgress?.(`Sincronizado ${item.entity_type} ${item.client_event_id.slice(0, 8)}`);
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        await db.syncQueue.update(item.id!, {
          status: "pending",
          retry_count: (item.retry_count ?? 0) + 1,
          last_error: message,
          updated_at: new Date().toISOString(),
        });
        onProgress?.(`Falha: ${message}`);
      }
    }

    await setMeta("last_sync_at", new Date().toISOString());
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

export function startAutoSync(intervalMs = 30000) {
  if (typeof window === "undefined") return () => {};

  const run = () => {
    if (isOnline()) processSyncQueue();
  };

  window.addEventListener("online", run);
  const id = setInterval(run, intervalMs);
  run();

  return () => {
    window.removeEventListener("online", run);
    clearInterval(id);
  };
}

export function createClientEventId() {
  return uuidv4();
}
