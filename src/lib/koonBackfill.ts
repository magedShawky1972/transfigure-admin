export const KOON_BACKFILL_PAGE_SIZE = 5;

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
  const preparationFinished = ["ready", "running", "completed", "completed_with_errors"].includes(runStatus);
  if (preparationFinished || (runStatus === "preparing" && stat.phase < currentPhase)) return "completed";
  return "waiting";
}
