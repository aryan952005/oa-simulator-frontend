import { Link } from 'react-router-dom';
import { MAX_DURATION_MIN, MAX_QUESTIONS, MIN_DURATION_MIN, MIN_QUESTIONS } from '../config/limits';

// S1 Landing (/). Every claim here must be true for the product (spec S1).
const STEPS = [
  {
    icon: 'tune',
    title: 'Build a round',
    text: `Pick ${MIN_QUESTIONS} to ${MAX_QUESTIONS} questions by topic and difficulty, and set ${MIN_DURATION_MIN} to ${MAX_DURATION_MIN} minutes.`,
  },
  {
    icon: 'timer',
    title: 'Start the timer',
    text: 'The clock runs on the server and cannot be paused.',
  },
  {
    icon: 'terminal',
    title: 'Solve and Run',
    text: 'Write Python, Run it on the sample tests, and Submit it against all tests.',
  },
  {
    icon: 'assessment',
    title: 'Read your report',
    text: 'See how the round went, with insights and a next round to build.',
  },
];

const FEATURES = [
  {
    icon: 'tune',
    title: 'Round builder',
    text: 'Choose a topic and a difficulty for each question in your round.',
  },
  {
    icon: 'alarm',
    title: 'Server-timed rounds',
    text: 'The server keeps the clock, so your countdown is the same after a refresh.',
  },
  {
    icon: 'play_circle',
    title: 'Run on samples, Submit on all tests',
    text: 'Run shows the sample results. Submit tells you Accepted or Not accepted.',
  },
  {
    icon: 'query_stats',
    title: 'A report with insights',
    text: 'Every finished round gets a report with a grade, a time map and insights.',
  },
];

export default function LandingPage() {
  return (
    <div data-testid="screen-S1" className="w-full">
      <section className="relative px-margin-desktop py-space-xl overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-16 left-1/4 w-96 h-96 bg-primary-fixed rounded-full blur-3xl opacity-40 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-48 right-10 w-80 h-80 bg-secondary-fixed rounded-full blur-3xl opacity-30 pointer-events-none"
        />
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center gap-space-md py-space-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface">Practise Python under the clock.</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Practise timed Python problems in rounds you build yourself, then read a report of how the round went.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-space-md mt-space-sm">
            <Link
              to="/register"
              className="inline-flex items-center justify-center h-12 px-space-xl rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center h-12 px-space-xl rounded-lg bg-surface border border-border-subtle text-on-surface font-label-ui text-label-ui hover:bg-surface-container-lowest hover:border-border-hover transition-all"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="px-margin-desktop py-space-xl">
        <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
          <h2 id="steps-heading" className="font-headline-lg text-headline-lg text-on-surface text-center">
            How a round works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-code-lg text-label-code-lg text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-primary-container">
                    {step.icon}
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{step.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="px-margin-desktop py-space-xl">
        <div className="max-w-7xl mx-auto flex flex-col gap-space-lg">
          <h2 id="features-heading" className="font-headline-lg text-headline-lg text-on-surface text-center">
            What you get
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-sm"
              >
                <span
                  aria-hidden="true"
                  className="w-10 h-10 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[22px]">{feature.icon}</span>
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{feature.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{feature.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
