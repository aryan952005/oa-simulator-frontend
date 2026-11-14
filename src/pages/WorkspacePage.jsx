import { useEffect, useState } from 'react';
import RoundGate from '../components/RoundGate';
import { WORKSPACE_MIN_WIDTH_PX } from '../config/limits';
import { useViewportWidth } from '../hooks/useViewportWidth';
import Workspace from '../workspace/Workspace';

// S8 Workspace (/rounds/:id/workspace). Only an ACTIVE round belongs here: RoundGate routes any
// other status away (FR15) and hands us the loaded round.
export default function WorkspacePage() {
  const wide = useViewportWidth() >= WORKSPACE_MIN_WIDTH_PX;

  // FD8: below the minimum width the screen shows one notice and nothing else. The workspace is not
  // opened on a narrow screen (opening a question starts its clock). If the window is made narrower
  // later, the workspace stays mounted but hidden, so unsaved code and the countdown are not lost.
  const [opened, setOpened] = useState(wide);
  useEffect(() => {
    if (wide) setOpened(true);
  }, [wide]);

  return (
    <>
      {!wide && (
        <div className="min-h-screen flex items-center justify-center p-space-lg bg-surface">
          <p role="alert" className="font-headline-sm text-headline-sm text-on-surface text-center max-w-md">
            This workspace needs a wider screen. Please use a computer.
          </p>
        </div>
      )}
      {opened && (
        <div className={wide ? undefined : 'hidden'}>
          <RoundGate expected="ACTIVE">{(round) => <Workspace round={round} />}</RoundGate>
        </div>
      )}
    </>
  );
}
