// Unit tests for console v2 growth/loyalty/bookings data (run: npx tsx scripts/growth.test.ts)
import {
  ACTIVE_DAILY,
  BOOKINGS_DAILY,
  BOOKING_HOURS,
  BOOKING_RESOURCES,
  BOOKING_UTILIZATION,
  COHORTS,
  EVENT_PERFORMANCE,
  LOYALTY_DAILY,
  OFFER_PERFORMANCE,
  TIER_MIX,
  eventFillPct,
  eventShowRate,
  loyaltyKpis,
  stickiness,
} from '../src/data/growth';
import { lastN } from '../src/data/analytics';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// growth
assert('90 days of actives', ACTIVE_DAILY.length === 90);
assert('wau >= dau always', ACTIVE_DAILY.every((d) => d.wau >= d.dau));
{
  const s = stickiness(lastN(ACTIVE_DAILY, 30));
  assert('stickiness DAU/WAU in 25-45% band', s > 25 && s < 45);
}
assert('8 weekly cohorts', COHORTS.length === 8);
assert('cohort week0 = 100', COHORTS.every((c) => c.retention[0] === 100));
assert('cohort retention monotonic non-increasing', COHORTS.every((c) => c.retention.every((r, i) => i === 0 || r <= c.retention[i - 1])));
assert('newer cohorts observed fewer weeks', COHORTS[0].retention.length === 8 && COHORTS[7].retention.length === 1);

// loyalty
assert('points redeemed < issued daily', LOYALTY_DAILY.every((d) => d.pointsRedeemed < d.pointsIssued));
{
  const k = loyaltyKpis(lastN(LOYALTY_DAILY, 30));
  assert('redemption rate 30-50%', k.redemptionRate >= 30 && k.redemptionRate <= 50);
  assert('liability positive and consistent', k.liabilitySar > 0);
  assert('members from latest day', k.members === LOYALTY_DAILY[89].members);
}
assert('tier mix totals members', TIER_MIX.reduce((a, b) => a + b.members, 0) === 3134);
assert('offer redemptions <= claims', OFFER_PERFORMANCE.every((o) => o.redemptions <= o.claims));

// bookings
assert('utilization covers all resources x hours', BOOKING_UTILIZATION.length === BOOKING_RESOURCES.length * BOOKING_HOURS.length);
assert('utilization percentages valid', BOOKING_UTILIZATION.every((u) => u.pct >= 0 && u.pct <= 100));
assert('bookings revenue scales with count', BOOKINGS_DAILY.every((d) => d.revenue > d.bookings * 100));

// events
assert('fill pct correct', eventFillPct(EVENT_PERFORMANCE[0]) === Math.round((27 / 32) * 100));
assert('show rate only for past events', eventShowRate(EVENT_PERFORMANCE[0]) === null && eventShowRate(EVENT_PERFORMANCE[4]) === 87);
assert('rsvps never exceed capacity', EVENT_PERFORMANCE.every((e) => e.rsvps <= e.capacity));

console.log(`\n${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
