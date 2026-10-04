import { TestType, TestTypeAssignment } from '../api/models';
import { counted, isInFlight, listed, shortDate } from '../shared/format';
import { inWords } from '../shared/work/sentences';
import { ChecksMet, ChecksRead } from '../shared/work/checks-met.component';

/** A run's title, and how a breadcrumb names it: it has no name of its own, only when it ran -
 *  "Run of 1 Oct, 20:23" (in the reader's own order). */
export const runOf = (iso: string) =>
  `Run of ${shortDate(iso)}, ${new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

/** Where a run's answer came from, in a few words: asked live, or the test's recorded one. */
export function answerFrom(r: { output_source?: string | null; model_output?: string | null }) {
  return r.output_source
    ? r.output_source === 'application'
      ? 'Asked live'
      : 'Recorded answer'
    : r.model_output != null
      ? 'Recorded answer'
      : 'Asked live';
}

/**
 * A run's lede, under its title: what was asked and what read it - "One answer from your
 * application, read by three checks - each an LLM judge."; for a set's copy, "The set's copy of
 * the test, asked live and read by two checks."; when no answer came back, "… for one check to
 * read - it never came back."
 */
export function runLede(
  r: {
    status: string;
    output_source?: string | null;
    model_output?: string | null;
    test_type_assignments?: readonly unknown[] | null;
  },
  copy: boolean,
  allJudges: boolean,
) {
  const n = r.test_type_assignments?.length ?? 0;
  const checks = `${inWords(n)} ${n === 1 ? 'check' : 'checks'}`;
  const live = answerFrom(r) === 'Asked live';
  if (copy) {
    const how = live ? 'asked live' : 'with its recorded answer';
    if (r.status === 'NotRan') return `The set's copy of the test, ${how} - no answer came back.`;
    return `The set's copy of the test, ${how} and read by ${checks}.`;
  }
  const what = live ? 'One answer from your application' : "The test's recorded answer";
  if (r.status === 'NotRan') return `${what}, for ${checks} to read - it never came back.`;
  if (isInFlight(r.status)) return `${what}, to be read by ${checks}.`;
  return `${what}, read by ${checks}${allJudges && n > 1 ? ' - each an LLM judge' : ''}.`;
}

/** Every check of a run is an LLM judge - its lede says so ("each an LLM judge"). */
export const allJudges = (
  assignments: readonly TestTypeAssignment[] | null | undefined,
  byName: Map<string, TestType>,
) =>
  !!assignments?.length &&
  assignments.every((a) => byName.get(a.name)?.category === 'llm_as_judge');

/** "Relevance wasn't met.", "BERTScore and ROUGE weren't met.", past three how many; every one
 *  met: "Every check was met." */
export function notMetSays(c: ChecksMet) {
  const no = c.notMet;
  if (!c.total) return 'It has no checks.';
  if (!no.length) return 'Every check was met.';
  const who = no.length <= 3 ? listed(no) : counted(no.length, 'check');
  return `${who} ${no.length === 1 ? "wasn't" : "weren't"} met.`;
}
/** The ones met, after: "Bias and Toxicity were." - past three, how many. */
export function metSays(c: ChecksRead) {
  const yes = c.names.filter((n) => !c.notMet.includes(n));
  if (!yes.length || !c.notMet.length) return '';
  return yes.length <= 3
    ? `${listed(yes)} ${yes.length === 1 ? 'was' : 'were'}.`
    : `The other ${yes.length} were.`;
}
