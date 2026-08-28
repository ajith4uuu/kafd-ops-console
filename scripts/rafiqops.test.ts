// Rafiq mobility ops engine tests (run: npx tsx scripts/rafiqops.test.ts)
import {
  INCIDENT_SLA_HOURS,
  MAX_RIDE_PERCENT,
  ONBOARDING_STAGES,
  SEED_CANDIDATES,
  SEED_CLASSES,
  SEED_DRIVERS,
  SEED_INCIDENTS,
  SEED_PROMOS,
  SEED_SHUTTLES,
  SEED_VEHICLES,
  SEED_ZONES,
  SURGE_CAP,
  canActivate,
  driverIssues,
  expiringDocs,
  fareEstimate,
  incidentBreached,
  nextOnboardingStage,
  pricingIssues,
  promoEffectiveState,
  promoIssues,
  type RafiqDriver,
} from '../src/data/rafiqops';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

const TODAY = '2026-08-21';
const veh = (id: string) => SEED_VEHICLES.find((v) => v.id === id) ?? null;

// --- pricing & fares ---
assert('5 ride classes seeded', SEED_CLASSES.length === 5);
assert('seed pricing is valid', SEED_CLASSES.every((c) => pricingIssues(c).length === 0));
assert('negative per-km rejected', pricingIssues({ ...SEED_CLASSES[0], perKmSar: 0 }).length === 1);
assert('min fare must cover base', pricingIssues({ ...SEED_CLASSES[0], minFareSar: 3 }).some((i) => i.includes('Minimum fare')));
const go = SEED_CLASSES[0];
assert('metered fare adds up', fareEstimate(go, 10, 15, 1) === Math.round((6 + 16 + 6.75) * 100) / 100);
assert('minimum fare floors short trips', fareEstimate(go, 1, 2, 1) === go.minFareSar);
assert('surge multiplies', fareEstimate(go, 10, 15, 1.5) === Math.round(28.75 * 1.5 * 100) / 100);
assert('surge is capped at 2.0', fareEstimate(go, 10, 15, 9) === fareEstimate(go, 10, 15, SURGE_CAP));
assert('multiplier below 1 clamps to 1', fareEstimate(go, 10, 15, 0.5) === fareEstimate(go, 10, 15, 1));

// --- zones ---
assert('5 zones, all within cap', SEED_ZONES.length === 5 && SEED_ZONES.every((z) => z.multiplier >= 1 && z.multiplier <= SURGE_CAP));

// --- TGA driver compliance ---
const clean = SEED_DRIVERS[0];
assert('flagship driver activates cleanly', canActivate(clean, veh(clean.vehicleId!), SEED_CLASSES, TODAY));
assert('non-citizen blocked', driverIssues({ ...clean, saudiCitizen: false }, veh('veh-01'), SEED_CLASSES, TODAY).some((i) => i.includes('Saudi citizens')));
assert('under-25 blocked', driverIssues({ ...clean, age: 24 }, veh('veh-01'), SEED_CLASSES, TODAY).some((i) => i.includes('25')));
assert('expired TGA card blocked', driverIssues({ ...clean, tgaCardExpiry: '2026-01-01' }, veh('veh-01'), SEED_CLASSES, TODAY).some((i) => i.includes('TGA driver card')));
assert('expired medical blocked', driverIssues({ ...clean, medicalExpiry: '2026-08-01' }, veh('veh-01'), SEED_CLASSES, TODAY).some((i) => i.includes('medical')));
assert('failed competency blocked', driverIssues({ ...clean, competencyPassed: false }, veh('veh-01'), SEED_CLASSES, TODAY).some((i) => i.includes('competency')));
assert('no vehicle blocked', driverIssues({ ...clean, vehicleId: null } as RafiqDriver, null, SEED_CLASSES, TODAY).some((i) => i.includes('No vehicle')));
assert('broken AC blocked (veh-08)', driverIssues(clean, veh('veh-08'), SEED_CLASSES, TODAY).some((i) => i.includes('AC')));
assert('2019 model outside Go window (veh-06)', driverIssues(clean, veh('veh-06'), SEED_CLASSES, TODAY).some((i) => i.includes('Model year')));
assert('suspended driver drv-06 has expired medical', driverIssues(SEED_DRIVERS[5], veh('veh-06'), SEED_CLASSES, TODAY).some((i) => i.includes('medical')));
assert('onboarding driver drv-08 blocked on Absher + competency + AC', driverIssues(SEED_DRIVERS[7], veh('veh-08'), SEED_CLASSES, TODAY).length >= 3);
assert('every active seed driver is compliant today', SEED_DRIVERS.filter((d) => d.status === 'active').every((d) => canActivate(d, veh(d.vehicleId!), SEED_CLASSES, TODAY)));

// --- expiring documents ---
const expiring = expiringDocs(SEED_DRIVERS, SEED_VEHICLES, TODAY, 30);
assert('30d window catches the Sep 8 TGA card + operating card', expiring.length === 2);
assert('chase list sorted by expiry', expiring.every((e, i) => i === 0 || expiring[i - 1].expiry <= e.expiry));
assert('already-expired docs are not "expiring"', expiring.every((e) => e.expiry > TODAY));
assert('wider window catches more', expiringDocs(SEED_DRIVERS, SEED_VEHICLES, TODAY, 120).length > expiring.length);

// --- onboarding ---
assert('6 onboarding stages', ONBOARDING_STAGES.length === 6);
assert('applied advances to absher', nextOnboardingStage('applied') === 'absher');
assert('live is terminal', nextOnboardingStage('live') === null);
assert('4 candidates seeded across stages', SEED_CANDIDATES.length === 4 && new Set(SEED_CANDIDATES.map((c) => c.stage)).size === 4);

// --- shuttles ---
assert('3 shuttle routes, one dormant', SEED_SHUTTLES.length === 3 && SEED_SHUTTLES.filter((s) => !s.active).length === 1);

// --- promos ---
assert('4 promos seeded', SEED_PROMOS.length === 4);
assert('valid promo has no issues', promoIssues(SEED_PROMOS[0]).length === 0);
assert('lowercase code rejected', promoIssues({ ...SEED_PROMOS[0], code: 'kafd15' }).length === 1);
assert('percent above cap rejected', promoIssues({ ...SEED_PROMOS[1], value: MAX_RIDE_PERCENT + 1 }).some((i) => i.includes(String(MAX_RIDE_PERCENT))));
assert('zero budget rejected', promoIssues({ ...SEED_PROMOS[0], budgetSar: 0 }).some((i) => i.includes('Budget')));
assert('reversed dates rejected', promoIssues({ ...SEED_PROMOS[0], validFrom: '2026-10-01', validTo: '2026-09-01' }).some((i) => i.includes('End date')));
assert('KAFD15 reads live', promoEffectiveState(SEED_PROMOS[0], TODAY) === 'live');
assert('COMMUTE20 near budget still live', promoEffectiveState(SEED_PROMOS[1], TODAY) === 'live');
assert('spent >= budget reads exhausted', promoEffectiveState({ ...SEED_PROMOS[1], spentSar: 18000 }, TODAY) === 'exhausted');
assert('exhausted beats the clock window', promoEffectiveState({ ...SEED_PROMOS[2], spentSar: 30000 }, TODAY) === 'exhausted');
assert('EIDRIDE reads scheduled', promoEffectiveState(SEED_PROMOS[2], TODAY) === 'scheduled');
assert('draft wins over the clock', promoEffectiveState(SEED_PROMOS[3], TODAY) === 'draft');
assert('past window reads expired', promoEffectiveState({ ...SEED_PROMOS[0], validFrom: '2026-01-01', validTo: '2026-02-01' }, TODAY) === 'expired');

// --- incidents ---
assert('SLA tightens with severity', INCIDENT_SLA_HOURS.sos < INCIDENT_SLA_HOURS.safety && INCIDENT_SLA_HOURS.safety < INCIDENT_SLA_HOURS.service);
assert('acknowledged SOS at 0.5h not breached', !incidentBreached(SEED_INCIDENTS[0]));
assert('open fare dispute at 30h breaches 24h SLA', incidentBreached(SEED_INCIDENTS[3]));
assert('resolved incident never breaches', !incidentBreached(SEED_INCIDENTS[4]));
assert('open safety at 2h within 4h SLA', !incidentBreached(SEED_INCIDENTS[1]));
assert('exactly one seeded breach', SEED_INCIDENTS.filter(incidentBreached).length === 1);

console.log(`rafiqops: ${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
