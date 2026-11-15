/** Verdict as it appears on the crew list; defined locally to keep the domain free of adapter imports. */
type OrderedVerdict = 'ok' | 'attention' | 'alert';

/** Lower rank comes first: `alert` before `attention` before `ok`. */
const VERDICT_RANK: Record<OrderedVerdict, number> = {
  alert: 0,
  attention: 1,
  ok: 2,
};

/** Urgency of an open alert; `now` is handled before `soon` (research R9). */
type OrderedUrgency = 'soon' | 'now';

/** Lower rank comes first: `now` before `soon`. */
const URGENCY_RANK: Record<OrderedUrgency, number> = {
  now: 0,
  soon: 1,
};

const BEFORE = -1;
const AFTER = 1;
const SAME = 0;

function compareNumbers(left: number, right: number): number {
  if (left < right) return BEFORE;
  if (left > right) return AFTER;
  return SAME;
}

/**
 * Orders crew entries by verdict (`alert`, `attention`, `ok`), then most recent `completedAt` first.
 * Returns a new array; the input is not mutated.
 */
export function orderCrew<T extends { verdict: OrderedVerdict; completedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const byVerdict = compareNumbers(VERDICT_RANK[left.verdict], VERDICT_RANK[right.verdict]);
    if (byVerdict !== SAME) return byVerdict;
    return compareNumbers(Date.parse(right.completedAt), Date.parse(left.completedAt));
  });
}

/**
 * Orders open alerts by urgency (`now` first), then oldest `createdAt` first.
 * Returns a new array; the input is not mutated.
 */
export function orderAlerts<T extends { urgency: OrderedUrgency; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const byUrgency = compareNumbers(URGENCY_RANK[left.urgency], URGENCY_RANK[right.urgency]);
    if (byUrgency !== SAME) return byUrgency;
    return compareNumbers(Date.parse(left.createdAt), Date.parse(right.createdAt));
  });
}
