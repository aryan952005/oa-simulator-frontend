import { Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/guards';
import ErrorBanner from './components/ErrorBanner';
import FullPageSkeleton from './components/FullPageSkeleton';
import AppShell from './layouts/AppShell';
import PublicLayout from './layouts/PublicLayout';
import CreateRoundPage from './pages/CreateRoundPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MyRoundsPage from './pages/MyRoundsPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import ReportPage from './pages/ReportPage';
import RoundRouterPage from './pages/RoundRouterPage';
import WorkspacePage from './pages/WorkspacePage';

export default function App() {
  const { status, error, retry } = useAuth();

  // FR4: a stored token is checked with E4 before any route is shown.
  if (status === 'loading') return <FullPageSkeleton />;

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-space-lg">
        <div className="w-full max-w-xl">
          <ErrorBanner error={error} onRetry={retry} />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public only: a logged-in user is sent to /dashboard (FR24) */}
      <Route element={<PublicOnlyRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Logged in only: a logged-out user is sent to /login with returnTo (FR23) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rounds/new" element={<CreateRoundPage />} />
          <Route path="/rounds" element={<MyRoundsPage />} />
          <Route path="/rounds/:id" element={<RoundRouterPage />} />
          <Route path="/rounds/:id/report" element={<ReportPage />} />
        </Route>
        {/* The workspace has its own header (built in F4), so it is outside the app shell */}
        <Route path="/rounds/:id/workspace" element={<WorkspacePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
