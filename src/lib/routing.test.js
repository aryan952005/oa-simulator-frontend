import { describe, expect, it } from 'vitest';
import { routeForStatus } from './routing';

// FR15: READY goes to S7 (round details), ACTIVE to S8 (workspace), FINISHED to S10 (report).
describe('routeForStatus (FR15)', () => {
  it('READY goes to the round details page', () => expect(routeForStatus('r1', 'READY')).toBe('/rounds/r1'));
  it('ACTIVE goes to the workspace', () => expect(routeForStatus('r1', 'ACTIVE')).toBe('/rounds/r1/workspace'));
  it('FINISHED goes to the report', () => expect(routeForStatus('r1', 'FINISHED')).toBe('/rounds/r1/report'));
  it('escapes the id', () => expect(routeForStatus('a/b', 'ACTIVE')).toBe('/rounds/a%2Fb/workspace'));
});
