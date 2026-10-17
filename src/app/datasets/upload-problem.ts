import { InvalidLines } from '../api/models';
import { errText } from '../shared/format';

/** What the API refused about a dataset's upload (API 2.3.0), by where the dialog says it. */
export type UploadProblem =
  /** 409: a dataset already has the name - said under the name. */
  | { kind: 'name'; text: string }
  /** 422: lines that aren't rows - the first ones, and how many in all. */
  | { kind: 'lines'; lines: InvalidLines }
  /** 413, or a 422 in a sentence: the file itself - too big, or not UTF-8 text. */
  | { kind: 'file'; text: string }
  /** Anything else, as the API says it. */
  | { kind: 'other'; text: string };

/** The API's refusal of an upload, sorted: its status and the shape of its `detail` - a string,
 *  an object of lines, or FastAPI's own list - tell them apart. */
export function uploadProblem(e: unknown): UploadProblem {
  const err = e as { status?: number; error?: { detail?: unknown } } | null;
  const status = err?.status;
  const detail = err?.error?.detail;
  const said = typeof detail === 'string' ? detail : null;
  if (status === 409) return { kind: 'name', text: said ?? 'A dataset already has this name.' };
  if (status === 422 && isInvalidLines(detail)) return { kind: 'lines', lines: detail };
  // A 413 from something in front of the API (a proxy) comes without the API's sentence.
  if (status === 413)
    return { kind: 'file', text: said ?? 'The file is too large for the server.' };
  if (status === 422 && said) return { kind: 'file', text: said };
  return { kind: 'other', text: errText(e) };
}

const isInvalidLines = (d: unknown): d is InvalidLines =>
  !!d && typeof d === 'object' && Array.isArray((d as InvalidLines).lines);
