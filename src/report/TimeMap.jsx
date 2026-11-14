import { axisTicks, filledMinutes } from '../lib/report';

const CAPTION =
  'Minutes from the start of the round. Filled minutes show when you were working on each question. This is approximate, because reading without typing is not counted.';

// Spec S10, Time map: one row per question (Q n), a scale from 0 to `totalMinutes` with a tick every
// 5 minutes, and a filled cell for each minute in that question's `activeMinutes`.
export default function TimeMap({ timeMap }) {
  const total = timeMap.totalMinutes;
  const rows = timeMap.questions;
  if (rows.length === 0 || total <= 0) return null;
  const ticks = axisTicks(total);
  const columns = { gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` };

  return (
    <section aria-labelledby="time-map-heading" className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-level-1 p-space-lg flex flex-col gap-space-md break-inside-avoid">
      <h2 id="time-map-heading" className="font-headline-md text-headline-md text-on-surface">
        Time map
      </h2>
      <div data-testid="time-map" className="flex flex-col gap-space-sm">
        {rows.map((row) => {
          const filled = filledMinutes(row.activeMinutes, total);
          return (
            <div key={row.index} data-testid="time-map-row" data-question={row.index} className="flex items-center gap-space-sm">
              <span className="w-10 shrink-0 font-label-ui text-label-ui text-on-surface">{`Q${row.index}`}</span>
              <div className="flex-1 grid h-6 rounded bg-surface-container" style={columns}>
                {Array.from({ length: total }, (_, minute) => (
                  <span
                    key={minute}
                    data-minute={minute}
                    data-active={filled.has(minute) ? 'true' : 'false'}
                    className={filled.has(minute) ? 'bg-primary-container' : ''}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div aria-hidden="true" data-testid="time-map-scale" className="flex items-start gap-space-sm">
          <span className="w-10 shrink-0" />
          <div className="relative flex-1 h-8">
            {ticks.map((tick) => (
              <span
                key={tick.minute}
                data-tick={tick.minute}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(tick.minute / total) * 100}%` }}
              >
                <span className="block w-px h-2 bg-border-hover" />
                {tick.labelled && <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">{tick.minute}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{CAPTION}</p>
    </section>
  );
}
