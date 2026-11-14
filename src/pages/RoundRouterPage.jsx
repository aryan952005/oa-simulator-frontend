import RoundGate from '../components/RoundGate';
import RoundDetailsPage from './RoundDetailsPage';

// /rounds/:id is the round router (FR15). A READY round shows S7 here. An ACTIVE round goes to the
// workspace and a FINISHED round goes to the report.
export default function RoundRouterPage() {
  return <RoundGate expected="READY">{(round) => <RoundDetailsPage round={round} />}</RoundGate>;
}
