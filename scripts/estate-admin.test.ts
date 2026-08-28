// Estate Admin (URWA core) seed + analytics tests (run: npx tsx scripts/estate-admin.test.ts)
import { estateKpis, hrKpis } from '../src/data/analytics';
import {
  DAYS,
  EMPLOYEES,
  ESTATE_OPS_DAILY,
  ESTATE_PARTNERS,
  RECRUITMENT,
  WPS_RUNS,
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

// --- seed shape & stability ---
assert('ops series covers 90 days', ESTATE_OPS_DAILY.length === DAYS);
assert('volumes always positive', ESTATE_OPS_DAILY.every((d) => d.laundry > 0 && d.housekeeping > 0 && d.roomService > 0));
assert('sla missed never exceeds volume', ESTATE_OPS_DAILY.every((d) => d.slaMissed <= d.laundry + d.housekeeping + d.roomService));
assert('credits only when misses', ESTATE_OPS_DAILY.every((d) => (d.slaMissed === 0 ? d.creditsPaid === 0 : d.creditsPaid > 0)));
assert('gate denials a thin band', ESTATE_OPS_DAILY.every((d) => d.gateDenied >= 2 && d.gateDenied <= 9));
assert('8 partners seeded', ESTATE_PARTNERS.length === 8);
assert('6 partners live', ESTATE_PARTNERS.filter((p) => p.status === 'live').length === 6);
assert('agreement numbers PRT-2026-######', ESTATE_PARTNERS.every((p) => /^PRT-2026-\d{6}$/.test(p.agreementNo)));
assert('commission matches category', ESTATE_PARTNERS.every((p) =>
  (p.category === 'laundry' && p.commissionPct === 15) ||
  (p.category === 'housekeeping' && p.commissionPct === 12) ||
  (p.category === 'room_service' && p.commissionPct === 18)));
assert('24 employees', EMPLOYEES.length === 24);
assert('housing is 25% of basic', EMPLOYEES.every((e) => e.housingSar === Math.round(e.basicSar * 0.25)));
assert('3 WPS runs, latest submitted', WPS_RUNS.length === 3 && WPS_RUNS[0].status === 'submitted');
assert('WPS SIF reference format', WPS_RUNS.every((r) => /^WPS-SIF-2026\d{2}-\d{4}$/.test(r.sifRef)));
assert('latest WPS total = payroll sum', WPS_RUNS[0].totalSar === EMPLOYEES.reduce((s, e) => s + e.basicSar + e.housingSar + e.otherSar, 0));
assert('recruitment funnels narrow monotonically', RECRUITMENT.every((r) => r.applied >= r.screening && r.screening >= r.interview && r.interview >= r.offer && r.offer >= r.hired));

// --- analytics ---
const k30 = estateKpis(30);
const manual30 = ESTATE_OPS_DAILY.slice(-30).reduce((s, d) => s + d.laundry + d.housekeeping + d.roomService, 0);
assert('estate orders sum window', k30.orders === manual30);
assert('sla pct in range', k30.slaPct > 90 && k30.slaPct <= 100);
assert('gate allowed >> denied', k30.gateAllowed > k30.gateDenied * 10);
assert('partner gross only counts live', k30.partnerGross === ESTATE_PARTNERS.filter((p) => p.status === 'live').reduce((s, p) => s + p.grossSar, 0));
assert('commission VAT is 15%', k30.commissionVat === Math.round(ESTATE_PARTNERS.filter((p) => p.status === 'live').reduce((s, p) => s + p.grossSar * (p.commissionPct / 100), 0) * 0.15));
const k7 = estateKpis(7);
assert('7d window smaller than 30d', k7.orders < k30.orders);

const hr = hrKpis();
assert('headcount 24', hr.headcount === 24);
assert('present+leave+absent consistent', hr.present + hr.onLeave + hr.absent === 24);
assert('attendance pct matches', hr.attendancePct === Math.round((hr.present / 24) * 1000) / 10);
assert('open roles = pipeline rows', hr.openRoles === RECRUITMENT.length);
assert('hired qtd sums funnel', hr.hiredQtd === RECRUITMENT.reduce((s, r) => s + r.hired, 0));

console.log(`estate-admin: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
