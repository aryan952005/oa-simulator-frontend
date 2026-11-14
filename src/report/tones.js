// Spec S10: how a tone looks. Green is good news, gold is a warning, error is for Needs work.
// Every colour here is a token from DESIGN.md (FR21).
export const BADGE_STYLE = {
  green: 'bg-success/[0.18] border-success text-on-surface',
  gold: 'bg-warning/[0.2] border-warning text-on-tertiary-fixed',
  error: 'bg-error-container border-error text-on-error-container',
};

export const HEADLINE_STYLE = {
  good: 'bg-success/[0.12] border-success',
  warning: 'bg-warning/[0.14] border-warning',
};

export const INSIGHT_STYLE = {
  good: 'border-l-success',
  warning: 'border-l-warning',
};

export const TONE_ICON = { good: 'check_circle', warning: 'bolt' };
export const TONE_ICON_STYLE = { good: 'bg-success text-on-surface', warning: 'bg-warning text-on-surface' };
