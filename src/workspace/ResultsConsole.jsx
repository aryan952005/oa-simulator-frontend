// S9: the last Run or Submit result for the selected question, in the console below the editor.
// It shows only what the spec lists. Never a test number, a per-test result on Submit, hidden data,
// or the reason for NOT_ACCEPTED.

const MONO = 'font-label-code-sm text-label-code-sm text-surface whitespace-pre-wrap break-words';

function Block({ label, children }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      <pre className={`${MONO} bg-editor-gutter border border-editor-border rounded-lg px-space-sm py-space-xs overflow-x-auto`}>{children}</pre>
    </div>
  );
}

function SyntaxError({ message }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <h3 className="font-headline-sm text-headline-sm text-error">Syntax error</h3>
      <pre className={MONO}>{message}</pre>
    </div>
  );
}

function SampleResult({ number, result }) {
  const failed = !result.passed;
  return (
    <li
      aria-label={`Sample ${number} result`}
      data-passed={failed ? 'false' : 'true'}
      className="flex flex-col gap-space-sm rounded-lg border border-editor-border bg-editor p-space-sm"
    >
      <div className="flex items-center justify-between gap-space-sm">
        <span className="font-label-ui text-label-ui text-surface">Sample {number}</span>
        <span className={`font-label-ui text-label-ui ${failed ? 'text-error' : 'text-success'}`}>
          Result: {failed ? 'Failed' : 'Passed'}
        </span>
      </div>
      <Block label="Input">{result.input}</Block>
      <Block label="Expected output">{result.expected}</Block>
      <Block label="Your output">{result.actual === '' ? '(no output)' : result.actual}</Block>
      {failed && result.status === 'RUNTIME_ERROR' && (
        <div className="flex flex-col gap-space-xs">
          <span className="font-label-ui text-label-ui text-error">Runtime error</span>
          {result.error && <pre className={MONO}>{result.error}</pre>}
        </div>
      )}
      {failed && result.status === 'TIME_LIMIT_EXCEEDED' && (
        <span className="font-label-ui text-label-ui text-error">Time limit exceeded</span>
      )}
    </li>
  );
}

function RunResult({ result, runsLeft }) {
  return (
    <article aria-label="Run result" className="flex flex-col gap-space-sm">
      {result.compilation ? (
        <SyntaxError message={result.compilation.message} />
      ) : (
        <>
          <h3 className="font-headline-sm text-headline-sm text-surface">
            Run: {result.testsPassed} of {result.totalTests} sample tests passed
          </h3>
          <ol className="flex flex-col gap-space-sm">
            {result.results.map((sample, i) => (
              <SampleResult key={i} number={i + 1} result={sample} />
            ))}
          </ol>
        </>
      )}
      <p className="font-body-sm text-body-sm text-on-surface-variant">Runs left {runsLeft}</p>
    </article>
  );
}

function SubmitResult({ result, submitsLeft }) {
  return (
    <article aria-label="Submit result" data-verdict={result.verdict} className="flex flex-col gap-space-sm">
      {result.verdict === 'ACCEPTED' && (
        <>
          <h3 className="font-headline-sm text-headline-sm text-success">Accepted</h3>
          <p className="font-body-md text-body-md text-surface">Your solution passed all tests.</p>
        </>
      )}
      {result.verdict === 'NOT_ACCEPTED' && (
        <>
          <h3 className="font-headline-sm text-headline-sm text-error">Not accepted.</h3>
          <p className="font-body-md text-body-md text-surface">Some test cases did not pass.</p>
        </>
      )}
      {result.verdict === 'COMPILATION_ERROR' && <SyntaxError message={result.errorMessage} />}
      <p className="font-body-sm text-body-sm text-on-surface-variant">Submits left {submitsLeft}</p>
    </article>
  );
}

export default function ResultsConsole({ result, runsLeft, submitsLeft }) {
  return (
    <section aria-label="Results" className="h-56 shrink-0 rounded-lg bg-editor border border-editor-border p-space-md overflow-y-auto">
      {!result && <p className="font-label-code-sm text-label-code-sm text-on-surface-variant">No results yet.</p>}
      {result && result.kind === 'run' && <RunResult result={result} runsLeft={runsLeft} />}
      {result && result.kind === 'submit' && <SubmitResult result={result} submitsLeft={submitsLeft} />}
    </section>
  );
}
