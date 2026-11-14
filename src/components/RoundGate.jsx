import { Navigate, useParams } from 'react-router-dom';
import { getRound } from '../api/rounds';
import { useApi } from '../hooks/useApi';
import { routeForStatus } from '../lib/routing';
import ErrorBanner from './ErrorBanner';
import RoundNotFound from './RoundNotFound';
import Skeleton from './Skeleton';

function Frame({ children }) {
  return <div className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-lg">{children}</div>;
}

function GateSkeleton() {
  return (
    <Frame>
      <div aria-busy="true" aria-label="Loading round" className="flex flex-col gap-space-md">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    </Frame>
  );
}

/**
 * FR15 for a screen that needs a round in one status. It loads the round with E8, then:
 *  - if the status is the one the screen expects, it renders `children(round)`;
 *  - otherwise it sends the user to the screen for the round's real status.
 * A 404 shows the not-found view (FR1). Other failures show the error with a Retry button (FR22).
 */
export default function RoundGate({ expected, children }) {
  const { id } = useParams();
  const round = useApi((options) => getRound(id, options), [id]);

  if (round.status === 'loading') return <GateSkeleton />;

  if (round.status === 'error') {
    return (
      <Frame>
        {round.error.code === 'NOT_FOUND' ? (
          <RoundNotFound />
        ) : (
          <ErrorBanner error={round.error} onRetry={round.reload} />
        )}
      </Frame>
    );
  }

  if (round.data.status !== expected) {
    return <Navigate to={routeForStatus(id, round.data.status)} replace />;
  }
  return children(round.data);
}
