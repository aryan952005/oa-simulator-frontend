// FR15: when a round's status is known, the user goes to
//  READY: S7 (round details), ACTIVE: S8 (workspace), FINISHED: S10 (report).
export function routeForStatus(id, status) {
  const base = `/rounds/${encodeURIComponent(id)}`;
  if (status === 'ACTIVE') return `${base}/workspace`;
  if (status === 'FINISHED') return `${base}/report`;
  return base;
}
