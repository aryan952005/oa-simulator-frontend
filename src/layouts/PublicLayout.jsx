import { Link, Outlet } from 'react-router-dom';

// The public header, used on the landing page only (login and register are full-page).
// Contents: the logo, a Log in link and a Create account button (approved F0 plan).
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl">
        <div className="h-16 max-w-7xl mx-auto px-margin-desktop flex items-center justify-between">
          <Link to="/" className="flex items-center gap-space-sm">
            <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                terminal
              </span>
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
              OA Simulator
            </span>
          </Link>
          <nav className="flex items-center gap-space-md">
            <Link
              to="/login"
              className="font-label-ui text-label-ui text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center h-10 px-space-md rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui hover:bg-primary-hover hover:shadow-primary-hover transition-all"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      <main className="w-full pt-16 bg-surface flex-1">
        <Outlet />
      </main>
      {/* Spec S1: keep only a copyright line and the two links. */}
      <footer className="w-full bg-surface-container-low py-space-lg">
        <div className="max-w-7xl mx-auto px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-md">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} OA Simulator
          </p>
          <nav aria-label="Footer" className="flex items-center gap-space-lg">
            <Link to="/login" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
              Log in
            </Link>
            <Link to="/register" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
