/**
 * Call dashboard helper functions for LeadSprint Retell-style live calls.
 */

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return '—';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getCallPollingInterval(
  calls?: Array<{ status?: string | null }> | null,
): number {
  if (!calls || !Array.isArray(calls)) return 10000;
  const hasActive = calls.some(
    (c) => c?.status === 'in_progress' || c?.status === 'queued',
  );
  return hasActive ? 2500 : 10000;
}

export function getCallStatusLabel(status?: string | null): string {
  if (!status) return '—';
  switch (status) {
    case 'in_progress':
      return 'LIVE';
    case 'queued':
      return 'CONNECTING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    case 'uncertain':
      return 'UNCERTAIN';
    case 'policy_blocked':
      return 'POLICY BLOCKED';
    default:
      return status.replaceAll('_', ' ').toUpperCase();
  }
}

export function calculateElapsedSeconds(
  startedAt?: string | null,
  nowMs = Date.now(),
): number | null {
  if (!startedAt) return null;
  const startMs = new Date(startedAt).getTime();
  if (isNaN(startMs)) return null;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}
