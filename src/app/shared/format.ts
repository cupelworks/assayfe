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
/** "Untitled · 1a2b3c4d" - the label for anything nameable that has no name. */
export const untitled = (id?: string | null) => `Untitled · ${short(id)}`;
/** A test's (or frozen entry's, or run's) display name: its own name, or `untitled(id)` when the
 *  name is missing or blank. The one spelling of that fallback - it used to be written out in
 *  seven places, one of them with a bare `.slice(0, 8)` instead of `short()`. */
export const displayName = (name: string | null | undefined, id?: string | null) =>
  name?.trim() || untitled(id);
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
/** An API error split for a form: `byField` holds each 422 problem under the form field it names -
 *  the deepest segment of its `loc`, after FastAPI's own location segment ("body"/"query"), that
 *  is one of `fields`; so ["body","url"], ["body","settings","url"] and ["body","headers","X-Key"]
 *  all land on their field. Everything else - a whole-request problem (loc ["body"]), a segment
 *  the form doesn't have, any non-422 error - goes to `other`, as one readable line, so nothing
 *  the API says is ever dropped. Several problems on one field are joined with "; ". */
export function fieldErrors(
  e: any,
  fields: readonly string[],
): { byField: Record<string, string>; other: string | null } {
  const d = e?.error?.detail;
  if (e?.status !== 422 || !Array.isArray(d)) return { byField: {}, other: errText(e) };
  const byField: Record<string, string> = {};
  const other: string[] = [];
  for (const x of d) {
    const path: string[] = (x?.loc ?? []).slice(1).map(String);
    const key = [...path].reverse().find((p) => fields.includes(p));
    if (key) byField[key] = byField[key] ? `${byField[key]}; ${x.msg}` : x.msg;
    else other.push(path.length ? `${path.join('.')}: ${x.msg}` : x.msg);
  }
  return { byField, other: other.length ? other.join('; ') : null };
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
