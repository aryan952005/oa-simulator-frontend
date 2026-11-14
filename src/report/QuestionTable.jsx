import { formatSpeed } from '../lib/format';
import { FAILURE_LABEL, FLAG_LABEL, RESULT_LABEL, difficultyLabel, topicLabel } from '../lib/labels';

const COLUMNS = [
  'Question',
  'Result',
  'Active time',
  'First run',
  'Runs / submits',
  'Failed submits',
  'Speed',
  'Why not solved',
  'Flags',
];

const DASH = '—';
const CELL = 'px-space-sm py-space-md font-body-md text-body-md text-on-surface align-top';

const RESULT_STYLE = {
  SOLVED: 'bg-success/[0.18] border-success text-on-surface',
  NOT_SOLVED: 'bg-error-container border-error text-on-error-container',
  NOT_OPENED: 'bg-surface-container-high border-border-subtle text-on-surface-variant',
};

// Spec S10, Speed (solved only): the time against the limit, for example `0.4 s of 2 s`.
function speedText(question) {
  if (question.result !== 'SOLVED' || question.runtimeMs === null || question.timeLimitMs === null) return DASH;
  return formatSpeed(question.runtimeMs, question.timeLimitMs);
}

// Unknown codes from the server show nothing instead of a made-up label.
const failureText = (question) => (question.failureReason && FAILURE_LABEL[question.failureReason]) || DASH;
const flagsText = (question) => {
  const labels = question.flags.map((flag) => FLAG_LABEL[flag]).filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : DASH;
};

// Spec S10, Question table: one row per question. Only the fields the API gives; never code, statements or test numbers.
export default function QuestionTable({ questions }) {
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="questions-heading" className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 overflow-hidden">
      <h2 id="questions-heading" className="font-headline-md text-headline-md text-on-surface px-space-lg pt-space-lg pb-space-sm">
        Questions
      </h2>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle">
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-space-sm py-space-sm font-label-ui text-label-ui text-on-surface-variant align-bottom">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((question) => (
              <tr key={question.index} data-testid="question-row" data-question={question.index} className="border-b border-border-subtle last:border-b-0 break-inside-avoid">
                <td className={CELL}>
                  {`Q${question.index} · ${topicLabel(question.topic)} · ${difficultyLabel(question.difficulty)}`}
                </td>
                <td className={CELL}>
                  <span className={`inline-flex items-center px-space-sm py-1 rounded-full border font-label-ui text-label-ui whitespace-nowrap ${RESULT_STYLE[question.result]}`}>
                    {RESULT_LABEL[question.result]}
                  </span>
                </td>
                <td className={`${CELL} whitespace-nowrap`}>{`${question.activeMin} of ${question.expectedMin} min`}</td>
                <td className={CELL}>
                  {question.firstRunAfterMin === null ? DASH : `${question.firstRunAfterMin} min after opening`}
                </td>
                <td className={`${CELL} whitespace-nowrap`}>{`${question.runCount} / ${question.submitCount}`}</td>
                <td className={CELL}>{question.failedSubmits}</td>
                <td className={`${CELL} whitespace-nowrap`}>{speedText(question)}</td>
                <td className={CELL}>{failureText(question)}</td>
                <td className={CELL}>{flagsText(question)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
