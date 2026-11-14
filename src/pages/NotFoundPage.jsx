import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const BUTTON =
  'inline-flex items-center justify-center h-11 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all';

// The not-found page for an address that is not a screen of the app (spec section 2, public).
// A 404 from the API for one round is a different view (RoundNotFound, FR1).
// A logged-in user is offered My rounds; a visitor is offered the home page.
export default function NotFoundPage() {
  const { user } = useAuth();
  const target = user ? { to: '/rounds', label: 'Back to My rounds' } : { to: '/', label: 'Go home' };

  return (
    <div data-testid="screen-not-found" className="min-h-screen bg-surface flex flex-col">
      <header className="h-16 px-margin md:px-margin-desktop flex items-center">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-space-sm">
          <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              terminal
            </span>
          </span>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">OA Simulator</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-space-lg">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-xl flex flex-col gap-space-md items-start">
          <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">explore_off</span>
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Page not found</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">There is nothing at this address.</p>
          <Link to={target.to} className={BUTTON}>
            {target.label}
          </Link>
        </div>
      </main>
    </div>
  );
}
