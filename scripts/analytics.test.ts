// Unit tests for ops-console analytics (run: npm test / npx tsx scripts/analytics.test.ts)
import {
  aiKpis,
  arrearsAging,
  auditToCsv,
  avgBy,
  co2Leaderboard,
  co2Program,
  dineKpis,
  driversAtRisk,
  filterAudit,
  goKpis,
  lastN,
  occupancy,
  openIncidents,
  overviewKpis,
  rafiqKpis,
  nafathVerifiedShare,
  rafiqEconomics,
  rentCollection,
  scheduledKpis,
  sumBy,
  topCorporateAccounts,
  trendPct,
  woByStatus,
  woSlaByPriority,
  workProgram,
} from '../src/data/analytics';
import {
  AUDIT_LOG,
  CORPORATE_ACCOUNTS,
  DAY_KEYS,
  RAFIQ_ECON_DAILY,
  RAFIQ_TAKE_RATE,
  DINE_PACING,
  RIDES_DAILY,
  SCHEDULED_DAILY,
  TODAY_KEY,
  VENUES,
  WORK_ORDERS,
} from '../src/data/seed';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// --- seed determinism & shape ---
assert('90 day keys, today last', DAY_KEYS.length === 90 && DAY_KEYS[89] === TODAY_KEY && TODAY_KEY === '2026-08-21');
assert('rides daily aligned to keys', RIDES_DAILY.length === 90 && RIDES_DAILY[0].day === DAY_KEYS[0]);
assert('ride class split sums to total', RIDES_DAILY.every((d) => Object.values(d.byClass).reduce((a, b) => a + b, 0) === d.total));
assert('pool matched never exceeds pool rides', RIDES_DAILY.every((d) => d.poolMatched <= d.byClass.pool));
assert('pacing covers every venue/hour', DINE_PACING.length === VENUES.length * 9);
assert('audit log sorted desc', AUDIT_LOG.every((e, i) => i === 0 || `${AUDIT_LOG[i - 1].day}${AUDIT_LOG[i - 1].time}` >= `${e.day}${e.time}`));

// --- generic helpers ---
assert('lastN slices tail', lastN([1, 2, 3, 4, 5], 7).length === 5 && lastN(RIDES_DAILY, 7).length === 7);
assert('sumBy rounds to 2dp', sumBy([{ v: 1.111 }, { v: 2.222 }], (x) => x.v) === 3.33);
assert('avgBy of empty is 0', avgBy([], () => 1) === 0);
{
  const flat = Array.from({ length: 20 }, () => ({ v: 10 }));
  assert('trendPct flat series is 0', trendPct(flat, 7, (x) => x.v) === 0);
  const rising = [...Array.from({ length: 7 }, () => ({ v: 10 })), ...Array.from({ length: 7 }, () => ({ v: 20 }))];
  assert('trendPct doubling is +100%', trendPct(rising, 7, (x) => x.v) === 100);
}

// --- pillar KPIs sanity ---
{
  const k = rafiqKpis(30);
  assert('rafiq rides positive', k.rides > 500);
  assert('pool match rate in PRD band', k.poolMatchRate > 45 && k.poolMatchRate < 85);
  assert('eta p95 >= p50', k.etaP95 > k.etaP50);
  assert('cancellation rate sane', k.cancellationRate > 0 && k.cancellationRate < 10);
}
{
  const k = dineKpis(30);
  assert('dine covers > reservations', k.covers > k.reservations);
  assert('no-show under 12%', k.noShowRate < 12);
  assert('waitlist claim rate 40-90%', k.waitlistClaimRate >= 40 && k.waitlistClaimRate <= 90);
}
{
  const k = goKpis(30);
  assert('go p90 above median', k.p90Delivery > k.medianDelivery);
  assert('desk share is a percentage', k.deskShare > 10 && k.deskShare < 90);
  assert('issue rate under PRD 4%… ok <6', k.issueRate < 6);
}
{
  const k = aiKpis(30);
  assert('ai tool accuracy 90-100', k.toolAccuracy >= 90 && k.toolAccuracy <= 100);
  assert('cost per transaction < SAR 0.4 target ballpark', k.costPerTransaction > 0 && k.costPerTransaction < 1);
}

// --- CO2 program ---
{
  const program = co2Program(30);
  assert('co2 cumulative is monotonic', program.cumulative.every((p, i) => i === 0 || p.cumulativeKg >= program.cumulative[i - 1].cumulativeKg));
  assert('co2 total equals last cumulative', program.totalKg === program.cumulative[program.cumulative.length - 1].cumulativeKg);
  assert('car km equivalence inverse of factor', Math.abs(program.carKmEquivalent - Math.round(program.totalKg / 0.12)) < 1);
  const wide = co2Program(90);
  assert('90d co2 >= 30d co2', wide.totalKg >= program.totalKg);
  const board = co2Leaderboard();
  assert('leaderboard sorted desc', board.every((r, i) => i === 0 || board[i - 1].kg >= r.kg));
}

// --- drivers / incidents ---
assert('at-risk drivers include suspended', driversAtRisk().some((d) => d.status === 'suspended'));
assert('open incidents subset', openIncidents().every((i) => i.status !== 'resolved') && openIncidents().length >= 2);

// --- living ---
{
  const occ = occupancy();
  assert('occupancy units 157', occ.units === 157);
  assert('occupancy rate matches leased/units', Math.abs(occ.ratePct - Math.round((occ.leased / occ.units) * 1000) / 10) < 0.01);
  const sla = woSlaByPriority();
  assert('sla rows for 3 priorities', sla.length === 3 && sla.every((row) => row.withinSla <= row.total));
  const statuses = woByStatus();
  assert('work order statuses sum to total', Object.values(statuses).reduce((a, b) => a + b, 0) === WORK_ORDERS.length);
  const aging = arrearsAging();
  assert('aging buckets count all overdue', aging.reduce((a, b) => a + b.count, 0) >= 1);
  const rent = rentCollection();
  assert('rent collected pct consistent', rent.collectedPct > 50 && rent.paid < rent.total);
}

// --- audit ---
{
  const dineOnly = filterAudit(AUDIT_LOG, { pillar: 'dine' });
  assert('audit pillar filter', dineOnly.length > 0 && dineOnly.every((e) => e.pillar === 'dine'));
  const merchant = filterAudit(AUDIT_LOG, { role: 'merchant' });
  assert('audit role filter', merchant.every((e) => e.role === 'merchant'));
  const search = filterAudit(AUDIT_LOG, { query: 'surge' });
  assert('audit text search', search.length > 0 && search.every((e) => e.action.includes('surge')));
  const combined = filterAudit(AUDIT_LOG, { pillar: 'rafiq', query: 'surge' });
  assert('audit combined filters', combined.every((e) => e.pillar === 'rafiq' && e.action.includes('surge')));
  const csv = auditToCsv(AUDIT_LOG.slice(0, 3));
  assert('csv header + 3 rows', csv.split('\n').length === 4 && csv.startsWith('id,day,time,actor'));
}

// --- overview roll-up ---
{
  const o = overviewKpis(30);
  assert('overview gmv = rafiq+go', Math.abs(o.gmv - (rafiqKpis(30).gmv + goKpis(30).gmv)) < 0.02);
  assert('overview mirrors pillar counts', o.rides === rafiqKpis(30).rides && o.orders === goKpis(30).orders && o.covers === dineKpis(30).covers);
  assert('overview open incidents', o.openIncidents === openIncidents().length);
}

// --- scheduled rides & work program ---
{
  assert('scheduled daily aligned to keys', SCHEDULED_DAILY.length === 90 && SCHEDULED_DAILY[0].day === DAY_KEYS[0]);
  assert(
    'scheduled outcomes sum to reserved',
    SCHEDULED_DAILY.every((d) => d.completed + d.freeCancels + d.lateCancels === d.reserved),
  );
  assert('scheduled pre-launch days are zero', SCHEDULED_DAILY.slice(0, 25).every((d) => d.reserved === 0));
  assert('scheduled has post-launch volume', SCHEDULED_DAILY.slice(-30).every((d) => d.reserved > 0));
  const s90 = scheduledKpis(90);
  assert('scheduled completion pct consistent', s90.completionPct === Math.round((s90.completed / s90.reserved) * 1000) / 10);
  assert('late cancel fees = SAR 10 each', s90.lateCancelFeesSar === s90.lateCancels * 10);
  assert('on-time pct within window bounds', s90.onTimePct > 80 && s90.onTimePct <= 100);
  const s7 = scheduledKpis(7);
  assert('scheduled 7d subset smaller', s7.reserved > 0 && s7.reserved < s90.reserved);

  const w90 = workProgram(90);
  const w7 = workProgram(7);
  assert('work trips positive and windowed', w7.workTrips > 0 && w7.workTrips < w90.workTrips);
  assert('work share is a sane fraction', w90.workSharePct > 5 && w90.workSharePct < 40);
  assert('work gmv scales with trips', w90.workGmv > w90.workTrips * 10);
  assert('active corporate accounts counted', w90.activeAccounts === CORPORATE_ACCOUNTS.filter((a) => a.status === 'active').length);

  const top = topCorporateAccounts();
  assert('corporate accounts sorted by 30d gmv', top.every((a, i) => i === 0 || top[i - 1].workGmv30d >= a.workGmv30d));
  assert('corporate list complete', top.length === CORPORATE_ACCOUNTS.length);
}

// --- Rafiq unit economics ---
{
  assert('econ daily aligned to keys', RAFIQ_ECON_DAILY.length === 90 && RAFIQ_ECON_DAILY[0].day === DAY_KEYS[0]);
  assert(
    'flat + metered rides equal total rides',
    RAFIQ_ECON_DAILY.every((d, i) => d.flatRides + d.meteredRides === RIDES_DAILY[i].total),
  );
  assert(
    'flat + metered GMV equals ride GMV',
    RAFIQ_ECON_DAILY.every((d, i) => Math.abs(d.flatGmv + d.meteredGmv - RIDES_DAILY[i].gmv) < 0.02),
  );
  assert(
    'net revenue = take − subsidy',
    RAFIQ_ECON_DAILY.every((d, i) => Math.abs(d.netRevenue - (RIDES_DAILY[i].gmv * RAFIQ_TAKE_RATE - d.subsidyCost)) < 0.05),
  );
  assert('subsidy never negative', RAFIQ_ECON_DAILY.every((d) => d.subsidyCost >= 0));
  assert(
    'driver payout at least the non-take share',
    RAFIQ_ECON_DAILY.every((d, i) => d.driverPayout >= RIDES_DAILY[i].gmv * (1 - RAFIQ_TAKE_RATE) - 0.05),
  );
  const econ90 = rafiqEconomics(90);
  const econ7 = rafiqEconomics(7);
  assert('econ windows are subsets', econ7.netRevenue < econ90.netRevenue);
  assert('revenue per ride is positive and sane', econ90.revenuePerRide > 0.5 && econ90.revenuePerRide < 10);
  assert('net take below gross take (subsidy bites)', econ90.netTakePct < econ90.grossTakePct);
  assert('driver share is the majority of GMV', econ90.driverSharePct > 70);
  assert('flat rides are most of volume', econ90.flatRideSharePct > 45);
  const verified = nafathVerifiedShare(90);
  assert('nafath share within 0–90%', verified > 0 && verified <= 90);
  assert('nafath adoption ramps over the quarter', nafathVerifiedShare(7) > verified);
}

console.log(`\n${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
