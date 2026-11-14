import { Link } from 'react-router-dom';

// FR1: a 404 from the API shows the not-found view for that screen, with a link back to My rounds.
export default function RoundNotFound() {
  return (
    <div data-testid="round-not-found" className="flex flex-col items-start gap-space-sm bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Round not found</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">This round does not exist.</p>
      <Link
        to="/rounds"
        className="inline-flex items-center justify-center h-11 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all"
      >
        Back to My rounds
      </Link>
    </div>
  );
}
