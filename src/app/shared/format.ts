import { TestStatus } from '../api/models';

export function rel(iso?: string | null) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - +new Date(iso)) / 6e4);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const short = (id?: string | null) => String(id ?? '').slice(0, 8);
export const STATUS: { key: TestStatus; color: string }[] = [
  { key: 'Pending',   color: 'var(--color-neutral-400)' },
  { key: 'Running',   color: 'var(--color-accent-400)' },
  { key: 'Completed', color: 'var(--color-text)' },
  { key: 'Failed',    color: 'var(--color-accent)' },
];
export const statusColor = (s?: string) => STATUS.find(x => x.key === s)?.color ?? STATUS[0].color;
export function countByStatus(runs: { status: TestStatus }[]) { return STATUS.map(s => ({ ...s, value: runs.filter(r => r.status === s.key).length })); }
/** FastAPI puts human messages in `detail` (string, {message}, or a 422 list). */
export function errText(e: any): string {
  const d = e?.error?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x: any) => `${(x.loc ?? []).slice(1).join('.')}: ${x.msg}`).join('; ');
  return d?.message ?? d?.detail ?? (d ? JSON.stringify(d) : e?.message ?? 'Request failed');
}
/** Suggested evaluation strategies — the API validates names server-side (422 on unknown). */
export const TEST_TYPE_SUGGESTIONS = ['exact_match', 'rouge', 'bleu', 'semantic_similarity', 'llm_judge', 'toxicity'];
