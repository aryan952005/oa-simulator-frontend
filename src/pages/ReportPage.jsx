import { Navigate, useParams } from 'react-router-dom';
import { getReport } from '../api/rounds';
import ErrorBanner from '../components/ErrorBanner';
import RoundGate from '../components/RoundGate';
import RoundNotFound from '../components/RoundNotFound';
import { useApi } from '../hooks/useApi';
import { Headline, Insights } from '../report/Insights';
import NextRoundCard from '../report/NextRoundCard';
import QuestionTable from '../report/QuestionTable';
import ReportHeader from '../report/ReportHeader';
import ReportSkeleton from '../report/ReportSkeleton';
import SummaryRow from '../report/SummaryRow';
import TimeMap from '../report/TimeMap';

function ReportView({ round }) {
  const { id } = useParams();
  const report = useApi((options) => getReport(id, options), [id]);

  if (report.status === 'loading') return <ReportSkeleton />;

  if (report.status === 'error') {
    // 409 ROUND_NOT_FINISHED: the round router reloads the round and sends the user by its status (FR15).
    if (report.error.code === 'ROUND_NOT_FINISHED') return <Navigate to={`/rounds/${encodeURIComponent(id)}`} replace />;
    if (report.error.code === 'NOT_FOUND') return <RoundNotFound />;
    return <ErrorBanner error={report.error} onRetry={report.reload} />;
  }

  const data = report.data;
  return (
    <>
      <ReportHeader createdAt={round.createdAt} report={data} />
      <SummaryRow summary={data.summary} />
      <Headline headline={data.headline} />
      <Insights insights={data.insights} />
      <TimeMap timeMap={data.timeMap} />
      <QuestionTable questions={data.questions} />
      <NextRoundCard nextRound={data.nextRound} />
    </>
  );
}

// S10 Report. Shown only for a FINISHED round: RoundGate sends every other status elsewhere (FR15).
export default function ReportPage() {
  return (
    <RoundGate expected="FINISHED">
      {(round) => (
        <div data-testid="screen-S10" className="max-w-[1100px] mx-auto px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg print:max-w-none print:p-0">
          <ReportView round={round} />
        </div>
      )}
    </RoundGate>
  );
}
