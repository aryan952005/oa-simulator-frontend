import ErrorBanner from '../components/ErrorBanner';
import Skeleton from '../components/Skeleton';

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-space-xs">
      <h3 className="font-label-ui text-label-ui text-on-surface-variant uppercase tracking-wider">{title}</h3>
      {children}
    </section>
  );
}

const MONO_BLOCK =
  'bg-surface-container-low border border-border-subtle rounded-lg px-space-md py-space-sm font-label-code-lg text-label-code-lg text-on-surface whitespace-pre-wrap overflow-x-auto';

// The problem for the selected question (spec S8): title, statement with its line breaks kept, the
// formats and constraints, and the samples. Nothing hidden ever reaches this panel.
export default function ProblemPanel({ question, onRetry }) {
  if (question.status === 'error') {
    return <ErrorBanner error={question.error} onRetry={onRetry} />;
  }
  if (question.status !== 'open') {
    return (
      <div aria-busy="true" aria-label="Loading question" className="flex flex-col gap-space-md">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const { title, statement, inputFormat, outputFormat, constraints, samples } = question.data;
  return (
    <article aria-label="Problem" className="flex flex-col gap-space-md">
      <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
      <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{statement}</p>

      {inputFormat && (
        <Section title="Input format">
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{inputFormat}</p>
        </Section>
      )}
      {outputFormat && (
        <Section title="Output format">
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{outputFormat}</p>
        </Section>
      )}
      {constraints && (
        <Section title="Constraints">
          <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{constraints}</p>
        </Section>
      )}

      {samples.length > 0 && (
        <Section title="Samples">
          <ol className="flex flex-col gap-space-md">
            {samples.map((sample, i) => (
              <li key={i} aria-label={`Sample ${i + 1}`} className="flex flex-col gap-space-sm">
                <span className="font-label-ui text-label-ui text-on-surface">Sample {i + 1}</span>
                <div className="flex flex-col gap-space-xs">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Input</span>
                  <pre className={MONO_BLOCK}>{sample.input}</pre>
                </div>
                <div className="flex flex-col gap-space-xs">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Output</span>
                  <pre className={MONO_BLOCK}>{sample.output}</pre>
                </div>
                {sample.explanation && (
                  <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap">{sample.explanation}</p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </article>
  );
}
