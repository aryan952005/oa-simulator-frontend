import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../auth/initials';

// Sidebar items (spec S4): Dashboard, My rounds, Create round, and Log out.
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard', isActive: (p) => p === '/dashboard' },
  {
    label: 'My rounds',
    to: '/rounds',
    icon: 'history_edu',
    isActive: (p) => p.startsWith('/rounds') && p !== '/rounds/new',
  },
  { label: 'Create round', to: '/rounds/new', icon: 'tune', isActive: (p) => p === '/rounds/new' },
];

const ACTIVE_CLASSES = 'bg-primary-container text-on-primary font-bold shadow-primary-hover';
const IDLE_CLASSES =
  'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-label-ui text-label-ui';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-surface">
      <aside
        aria-label="Sidebar"
        className="fixed left-0 top-0 h-full w-64 bg-surface-container-low z-50 flex flex-col justify-between py-space-lg print:hidden"
      >
        <div className="flex flex-col gap-space-lg">
          <Link to="/dashboard" className="px-space-lg flex items-center gap-space-sm">
            <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                terminal
              </span>
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">
              OA Simulator
            </span>
          </Link>
          <nav className="flex flex-col gap-space-xs px-space-md">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg transition-all ${
                    active ? ACTIVE_CLASSES : IDLE_CLASSES
                  }`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="px-space-md">
          <button
            type="button"
            onClick={logout}
            className={`w-full flex items-center gap-space-sm px-space-md py-space-sm rounded-lg transition-all ${IDLE_CLASSES}`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="pl-64 print:pl-0">
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 print:hidden">
          <div className="h-full w-full px-space-lg flex items-center justify-end">
            <div className="flex items-center gap-space-sm">
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-label-ui text-label-ui font-bold"
              >
                {initials(user && user.name)}
              </span>
              <span data-testid="topbar-user-name" className="font-label-ui text-label-ui text-on-surface">
                {user && user.name}
              </span>
            </div>
          </div>
        </header>
        <main className="w-full pt-16 bg-surface min-h-screen print:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
