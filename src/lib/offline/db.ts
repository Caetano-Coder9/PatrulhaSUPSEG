import Dexie, { type Table } from "dexie";
import type {
  LocalPatrolLog,
  LocalIncident,
  SyncQueueItem,
  ActiveRouteState,
} from "@/lib/types";

export class SupsegDB extends Dexie {
  patrolLogs!: Table<LocalPatrolLog, string>;
  incidents!: Table<LocalIncident, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  activeRoute!: Table<ActiveRouteState & { id: string }, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("supseg_patrulha");
    this.version(1).stores({
      patrolLogs: "client_event_id, guard_id, checkpoint_id, synced, scanned_at",
      incidents: "client_event_id, guard_id, synced, reported_at",
      syncQueue: "++id, client_event_id, status, entity_type, created_at",
      activeRoute: "id",
      meta: "key",
    });
  }
}

export const db = typeof window !== "undefined" ? new SupsegDB() : (null as unknown as SupsegDB);

export async function getMeta(key: string): Promise<string | null> {
  if (!db) return null;
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  if (!db) return;
  await db.meta.put({ key, value });
}
