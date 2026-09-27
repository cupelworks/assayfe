import { TestStatus } from '../api/models';

export function rel(iso?: string | null) {
  if (!iso) return '-';
  const m = Math.round((Date.now() - +new Date(iso)) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const short = (id?: string | null) => String(id ?? '').slice(0, 8);
/** Absolute timestamp for a title/tooltip alongside rel()'s relative one - "4 d ago" alone loses
 *  precision the moment it matters. */
export function absTime(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
/** Best-effort clipboard write - false (never throws) if the Clipboard API is unavailable or
 *  permission is denied, so a caller can skip its "Copied" feedback rather than show it falsely. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
/** `key` is the wire value (must match the API's TestStatus enum exactly - e.g. "NotRan", no
 *  space - it's both compared against real run.status values and sent as the ?status= query
 *  param). `label` is display-only and free to read however's clearest ("Not Ran"); never use
 *  `key` as user-facing text. */
export const STATUS: { key: TestStatus; label: string; color: string }[] = [
  { key: 'Pending', label: 'Pending', color: 'var(--color-neutral-400)' },
  { key: 'Running', label: 'Running', color: 'var(--color-accent-400)' },
  { key: 'Green', label: 'Green', color: 'var(--color-status-green)' },
  { key: 'Amber', label: 'Amber', color: 'var(--color-status-amber)' },
  { key: 'Red', label: 'Red', color: 'var(--color-accent)' },
  { key: 'NotRan', label: 'Not Ran', color: 'var(--color-neutral-800)' },
];
export const statusColor = (s?: string) =>
  STATUS.find((x) => x.key === s)?.color ?? STATUS[0].color;
export const statusLabel = (s?: string) => STATUS.find((x) => x.key === s)?.label ?? s ?? '';
/** Pending or Running - a run that hasn't settled yet, i.e. one a page still has to wait (poll)
 *  for. The one place this pair of statuses is spelled out. */
export const isInFlight = (s?: string | null) => s === 'Pending' || s === 'Running';
export function countByStatus(runs: { status: TestStatus }[]) {
  return STATUS.map((s) => ({ ...s, value: runs.filter((r) => r.status === s.key).length }));
}
/** FastAPI puts human messages in `detail` (string, {message}, or a 422 list). */
export function errText(e: any): string {
  const d = e?.error?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d))
    return d.map((x: any) => `${(x.loc ?? []).slice(1).join('.')}: ${x.msg}`).join('; ');
  return d?.message ?? d?.detail ?? (d ? JSON.stringify(d) : (e?.message ?? 'Request failed'));
}
export const COST_ORDER = ['fast', 'medium', 'slow', 'expensive'];
export const categoryLabel = (c: string) =>
  (
    ({
      deterministic: 'Deterministic',
      nlp_metric: 'NLP metric',
      llm_as_judge: 'LLM as judge',
    }) as Record<string, string>
  )[c] ?? c;
