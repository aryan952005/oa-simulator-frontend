import { Link } from 'react-router-dom';

// The full-page split layout for Login and Register (spec S2, S3).
// Left: the logo, a headline and one sentence. Right: the form.
export default function AuthLayout({ screen, title, subtitle, children }) {
  return (
    <div data-testid={`screen-${screen}`} className="min-h-screen bg-surface lg:grid lg:grid-cols-12">
      <aside className="hidden lg:flex lg:col-span-5 relative overflow-hidden flex-col justify-between p-space-xl bg-gradient-to-br from-surface to-secondary-fixed">
        <div
          aria-hidden="true"
          className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-primary-container/15 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"
        />
        <Link to="/" className="relative z-10 flex items-center gap-space-sm w-fit">
          <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              terminal
            </span>
          </span>
          <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">
            OA Simulator
          </span>
        </Link>
        <div className="relative z-10 flex flex-col gap-space-md max-w-md">
          <h2 className="font-headline-xl text-headline-xl text-on-surface">{title}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{subtitle}</p>
        </div>
        <span aria-hidden="true" />
      </aside>

      <main className="lg:col-span-7 flex items-center justify-center px-margin md:px-margin-desktop py-space-xl">
        <div className="w-full max-w-md flex flex-col gap-space-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
