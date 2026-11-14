import { insightTone } from '../lib/labels';
import { HEADLINE_STYLE, INSIGHT_STYLE, TONE_ICON, TONE_ICON_STYLE } from './tones';

// Spec S10, Headline: the `headline.text` string, large. Its tone comes from its rule (green for TOO_EASY, gold otherwise).
export function Headline({ headline }) {
  const tone = insightTone(headline.rule);
  return (
    <section
      aria-label="Headline"
      data-testid="headline"
      data-tone={tone}
      className={`flex items-start gap-space-md rounded-xl border p-space-lg ${HEADLINE_STYLE[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${TONE_ICON_STYLE[tone]}`}
      >
        <span className="material-symbols-outlined text-[24px]">{TONE_ICON[tone]}</span>
      </span>
      <p className="font-headline-md text-headline-md text-on-surface">{headline.text}</p>
    </section>
  );
}

// Spec S10, Insights: up to three cards, in the order given. Each shows its `text` and its tone style.
export function Insights({ insights }) {
  const shown = insights.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Insights" className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
      {shown.map((insight, index) => {
        const tone = insightTone(insight.rule);
        return (
          <article
            key={`${insight.rule ?? 'insight'}-${index}`}
            data-testid="insight"
            data-tone={tone}
            className={`bg-surface-container-lowest border border-border-subtle border-l-4 ${INSIGHT_STYLE[tone]} rounded-xl shadow-level-1 p-space-lg break-inside-avoid`}
          >
            <p className="font-body-md text-body-md text-on-surface">{insight.text}</p>
          </article>
        );
      })}
    </section>
  );
}
