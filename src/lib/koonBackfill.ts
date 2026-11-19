export const KOON_BACKFILL_PAGE_SIZE = 5;

export interface KoonBackfillRun {
  id: string;
  from_date_int: number;
  to_date_int: number;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  skipped_counts?: Record<string, number>;
  current_phase: number;
  current_endpoint?: string;
  error_message?: string;
}

export interface KoonBackfillSummary {
  run: KoonBackfillRun;
  endpoints: KoonEndpointProgress[];
  batch?: unknown[];
}

export interface KoonBackfillItem {
  id: string;
  endpoint: string;
  record_key: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "success" | "failed";
  attempt_count: number;
  response_status?: number;
  response_message?: string;
  processed_at?: string;
}

export function canRetryKoonBackfillItem(item: Pick<KoonBackfillItem, "status">): boolean {
  return item.status === "failed";
}

export function dateToInt(date: Date): number {
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
}

export function intToDateIntString(value: number): string {
  const text = String(value);
  return `${text.slice(6, 8)}/${text.slice(4, 6)}/${text.slice(0, 4)}`;
}

export function isValidKoonBackfillRange(from?: Date, to?: Date): boolean {
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;
  return dateToInt(from) <= dateToInt(to);
}

export interface KoonEndpointProgress {
  phase: number;
  endpoint: string;
  total: number;
  pending: number;
  success: number;
  failed: number;
}

export type KoonEndpointStatus = "waiting" | "running" | "pending" | "completed" | "failed";

export function canResumeKoonBackfillEndpoint(runStatus: string, stat: Pick<KoonEndpointProgress, "pending">): boolean {
  return ["ready", "running", "paused"].includes(runStatus) && stat.pending > 0;
}

export function getKoonEndpointStatus(
  stat: KoonEndpointProgress,
  runStatus: string,
  currentPhase: number,
  activeEndpoint?: string,
): KoonEndpointStatus {
  if (activeEndpoint === stat.endpoint) return "running";
  if (stat.failed > 0 || (runStatus === "failed" && stat.phase === currentPhase)) return "failed";
  if (stat.total > 0 && stat.success === stat.total) return "completed";
  if (stat.pending > 0) return "pending";
  const preparationFinished = ["ready", "running", "paused", "completed", "completed_with_errors"].includes(runStatus);
  if (preparationFinished || (runStatus === "preparing" && stat.phase < currentPhase)) return "completed";
  return "waiting";
}
