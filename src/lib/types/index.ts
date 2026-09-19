// ============================================================
// SUPSEGPatrulha - Types
// ============================================================

export type UserRole = "admin" | "guard";

export type GpsStatus =
  | "verified"
  | "outside_radius"
  | "low_accuracy"
  | "permission_denied"
  | "unavailable";

export type LogStatus = "completed" | "missed" | "late" | "out_of_sequence";

export type SessionStatus = "in_progress" | "completed" | "missed" | "late";

export type IncidentSeverity = "low" | "medium" | "high";

export type IncidentStatus = "open" | "in_progress" | "resolved";

export type SyncStatus = "pending" | "processing" | "synced" | "failed";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  location_id: string | null;
  location?: Location;
  shift_info: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Checkpoint {
  id: string;
  location_id: string;
  code: string;
  name: string;
  qr_code_token: string;
  target_lat: number | null;
  target_lng: number | null;
  gps_radius_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface PatrolRoute {
  id: string;
  location_id: string;
  name: string;
  scheduled_time: string | null;
  tolerance_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location?: Location;
  route_checkpoints?: RouteCheckpoint[];
}

export interface RouteCheckpoint {
  id: string;
  route_id: string;
  checkpoint_id: string;
  sequence_order: number;
  created_at: string;
  checkpoint?: Checkpoint;
}

export interface PatrolSession {
  id: string;
  route_id: string;
  guard_id: string;
  location_id: string;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  created_at: string;
  route?: PatrolRoute;
  guard?: Profile;
  location?: Location;
}

export interface PatrolLog {
  id: string;
  patrol_session_id: string | null;
  route_id: string | null;
  guard_id: string;
  checkpoint_id: string;
  scanned_at: string;
  scanned_lat: number | null;
  scanned_lng: number | null;
  gps_accuracy_meters: number | null;
  gps_distance_meters: number | null;
  is_gps_valid: boolean;
  gps_status: GpsStatus | null;
  status: LogStatus;
  client_event_id: string | null;
  synced_offline: boolean;
  created_at: string;
  synced_at: string | null;
  checkpoint?: Checkpoint;
  guard?: Profile;
}

export interface Incident {
  id: string;
  guard_id: string;
  location_id: string | null;
  checkpoint_id: string | null;
  title: string;
  description: string | null;
  photo_url: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  client_event_id: string | null;
  synced_offline: boolean;
  created_at: string;
  guard?: Profile;
  location?: Location;
  checkpoint?: Checkpoint;
}

// Offline / local types
export interface LocalPatrolLog {
  client_event_id: string;
  patrol_session_id?: string;
  route_id?: string;
  guard_id: string;
  checkpoint_id: string;
  checkpoint_code?: string;
  checkpoint_name?: string;
  scanned_at: string;
  scanned_lat?: number;
  scanned_lng?: number;
  gps_accuracy_meters?: number;
  gps_distance_meters?: number;
  is_gps_valid: boolean;
  gps_status: GpsStatus;
  status: LogStatus;
  synced: boolean;
  created_at: string;
}

export interface LocalIncident {
  client_event_id: string;
  guard_id: string;
  location_id?: string;
  checkpoint_id?: string;
  title: string;
  description?: string;
  photo_blob?: Blob;
  photo_local_url?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reported_at: string;
  synced: boolean;
  created_at: string;
}

export interface SyncQueueItem {
  id?: number;
  entity_type: "patrol_session" | "patrol_log" | "incident";
  client_event_id: string;
  operation: "insert";
  payload: Record<string, unknown>;
  retry_count: number;
  status: SyncStatus;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveRouteState {
  id: string;
  guardId: string;
  sessionId: string | null;
  clientSessionId: string;
  routeId: string;
  routeName: string;
  locationId: string;
  locationName: string;
  checkpoints: Array<{
    id: string;
    code: string;
    name: string;
    sequence_order: number;
    qr_code_token: string;
    target_lat: number | null;
    target_lng: number | null;
    gps_radius_meters: number;
    status: "pending" | "scanned" | "late" | "out_of_sequence";
    scanned_at?: string;
  }>;
  startedAt: string;
  status: SessionStatus;
  completedAt?: string;
}
