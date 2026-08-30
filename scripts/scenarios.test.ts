// Cross-actor admin journey scenarios (run: npx tsx scripts/scenarios.test.ts)
// Catalog: docs/test-scenarios.md §6, §9–§13.
import {
  SEED_PROPERTIES,
  canList,
  classifyPhoto,
  listingIssues,
  offerEffectiveState,
  offerIssues,
  orderPhotos,
  placeholderPhoto,
  walkthroughPlan,
  SEED_DIRECTORY,
  SEED_OFFERS,
  type ManagedProperty,
  type PropertyPhoto,
} from '../src/data/portfolio';
import {
  SEED_RESERVATIONS,
  SEED_WAITLIST,
  canTransition,
  depositFor,
  noShowFee,
  pacingOk,
  suggestTable,
  tableFreeAt,
  waitlistQuote,
  SEED_POLICIES,
  type Reservation,
} from '../src/data/dineops';
import {
  SEED_CANDIDATES,
  SEED_CLASSES,
  SEED_DRIVERS,
  SEED_VEHICLES,
  canActivate,
  driverIssues,
  expiringDocs,
  nextOnboardingStage,
  promoEffectiveState,
  promoIssues,
  SEED_PROMOS,
  fareEstimate,
  SURGE_CAP,
  type OnboardingStage,
} from '../src/data/rafiqops';
import {
  ACCESS_REQUESTS,
  ADMINS,
  FINANCE_QUEUE,
  APPROVAL_LIMITS,
  ROLE_CATALOG,
  SOD_FORBIDDEN,
} from '../src/data/seed';

let passed = 0;
let failed = 0;
let scenario = '';
function feature(name: string) { scenario = name; }
function then(name: string, condition: boolean) {
  if (condition) passed += 1;
  else { failed += 1; console.error(`FAIL [${scenario}] ${name}`); }
}

// ===========================================================================
feature('S13.1 Admin adds property → gate → photos → walkthrough');
{
  const draft: ManagedProperty = {
    id: 'j-prop', title: 'Vue East 1501', building: 'Vue East', unitNo: '1501', type: 'residential',
    bedrooms: 2, bathrooms: 2, sqm: 120, priceSar: 150000, depositSar: 7000, brokerageSar: 3500,
    regaAdLicense: '', falLicense: '1200018493', amenities: [], description: '', status: 'draft',
    photos: [], walkthroughReady: false,
  };
  const blocks = listingIssues(draft);
  then('listing refused with the exact reasons', !canList(draft) && blocks.some((b) => b.includes('REGA')) && blocks.some((b) => b.includes('photos')));

  // photographer uploads scrambled files — auto-classified and route-ordered
  const uploads: PropertyPhoto[] = ['IMG_kitchen.jpg', 'drone-skyline.jpg', 'living-room.jpg', 'front-facade.jpg'].map((f, i) => ({
    id: `ph-${i}`, src: placeholderPhoto('living', 'x'), filename: f, slot: classifyPhoto(f), slotSource: 'auto',
  }));
  const ordered = orderPhotos(uploads);
  then('scrambled uploads order along the route, opener first',
    ordered[0].slot === 'outside' && ordered[ordered.length - 1].slot === 'final_exterior');

  const licensed: ManagedProperty = { ...draft, regaAdLicense: '7200481299', photos: ordered };
  then('with licence + 4 routed photos the unit lists', canList(licensed));
  const plan = walkthroughPlan(licensed.photos, licensed);
  then('walkthrough plan carries camera + narration per stop', plan.length === 4 && plan.every((s) => s.camera && s.narration));
}

// ===========================================================================
feature('S6.3 Host stand: confirm → seat auto-assign → no-show forfeits');
{
  let book: Reservation[] = [...SEED_RESERVATIONS];
  const chen = book.find((r) => r.guestName.includes('Chen'))!;
  then('a booked party cannot be seated before confirmation', !canTransition(chen.status, 'seated'));
  // confirm then seat with auto-assignment
  book = book.map((r) => (r.id === chen.id ? { ...r, status: 'confirmed' } : r));
  const table = suggestTable(book, chen.party, chen.time, chen.zonePref, chen.id);
  then('seat auto-assigns a fitting table', table != null && table.seats >= chen.party);
  book = book.map((r) => (r.id === chen.id ? { ...r, status: 'seated', tableId: table!.id } : r));
  then('the seated table now blocks its turn window', !tableFreeAt(book, table!.id, chen.time, 2));

  const qahtani = book.find((r) => r.guestName.includes('Qahtani'))!;
  then('no-show forfeits exactly the deposit held', canTransition(qahtani.status, 'no_show') && noShowFee(qahtani) === qahtani.depositPaidSar && qahtani.depositPaidSar === 200);
  then('deposit math matches venue policy', depositFor(SEED_POLICIES[0], qahtani.party) === qahtani.depositPaidSar);
}

feature('S6.3b Waitlist promote books a real slot');
{
  const entry = SEED_WAITLIST[0];
  const quote = waitlistQuote(SEED_RESERVATIONS, entry.party, '19:15');
  then('an honest quote exists', quote != null);
  then('the quoted slot has pacing room AND a table', quote != null && pacingOk(SEED_RESERVATIONS, quote) && suggestTable(SEED_RESERVATIONS, entry.party, quote) != null);
}

feature('S6.4 Pacing cap refuses the fifth seating');
{
  const packed: Reservation[] = [
    ...SEED_RESERVATIONS,
    { id: 'p1', guestName: 'a', party: 2, time: '19:00', status: 'confirmed', tableId: null, depositPaidSar: 0 },
    { id: 'p2', guestName: 'b', party: 2, time: '19:05', status: 'confirmed', tableId: null, depositPaidSar: 0 },
  ];
  then('slot at cap refuses the next seating', !pacingOk(packed, '19:10'));
}

// ===========================================================================
feature('S9.1 Fleet: onboarding pipeline → activation gate → clean activation');
{
  let stage: OnboardingStage = SEED_CANDIDATES[3].stage; // 'applied'
  const walked: string[] = [stage];
  while (nextOnboardingStage(stage)) { stage = nextOnboardingStage(stage)!; walked.push(stage); }
  then('candidate walks all six stages', walked.join('>') === 'applied>absher>tga_card>inspection>training>live');

  const ziyad = SEED_DRIVERS.find((d) => d.id === 'drv-08')!;
  const veh = SEED_VEHICLES.find((v) => v.id === ziyad.vehicleId)!;
  const blocks = driverIssues(ziyad, veh, SEED_CLASSES, '2026-08-30');
  then('activation names every block (Absher, age, competency, AC)', blocks.length >= 4);
  // documents + verification land; vehicle AC fixed
  const cleared = { ...ziyad, absherVerified: true, age: 26, competencyPassed: true };
  const fixedVeh = { ...veh, acWorking: true };
  then('the moment the checklist is clean, activation succeeds', canActivate(cleared, fixedVeh, SEED_CLASSES, '2026-08-30'));
}

feature('S9.2 Renewal chase list catches documents 30 days out');
{
  const chase = expiringDocs(SEED_DRIVERS, SEED_VEHICLES, '2026-08-21', 30);
  then('the Sep-8 TGA card and operating card are caught', chase.length === 2);
  then('sorted by expiry', chase.every((c, i) => i === 0 || chase[i - 1].expiry <= c.expiry));
}

// ===========================================================================
feature('S10.1 Promo lifecycle: invalid → fixed → live → exhausted');
{
  const bad = { ...SEED_PROMOS[0], value: 61, kind: 'percent' as const };
  then('61% cannot publish', promoIssues(bad).length > 0);
  const fixed = { ...bad, value: 20 };
  then('fixed to 20% it is valid and live in-window', promoIssues(fixed).length === 0 && promoEffectiveState(fixed, '2026-08-21') === 'live');
  then('budget exhaustion beats the clock', promoEffectiveState({ ...fixed, spentSar: fixed.budgetSar }, '2026-08-21') === 'exhausted');
}

feature('S10.2 Surge stays capped at 2.0×');
{
  const go = SEED_CLASSES[0];
  then('a 9× request clamps to the cap', fareEstimate(go, 12, 18, 9) === fareEstimate(go, 12, 18, SURGE_CAP));
}

// ===========================================================================
feature('S11.1 Four-eyes access: requester never approves');
then('every request names a different requester than its subject', ACCESS_REQUESTS.every((r) => r.requestedBy !== r.person));
then('an SoD-blocked mover exists and is flagged in its note', ACCESS_REQUESTS.some((r) => r.note.includes('SoD')));

feature('S11.2 Maker-checker: money needs two people');
{
  const decided = FINANCE_QUEUE.filter((f) => f.status !== 'pending');
  then('no decided item was self-approved', decided.every((f) => f.checker !== f.maker));
  const limit = APPROVAL_LIMITS.find((l) => l.role === 'finance_checker')!.limitSar;
  const over = FINANCE_QUEUE.filter((f) => f.status === 'pending' && f.amountSar > limit);
  then('the 112k payout demands a super-admin co-sign', over.length === 1 && over[0].ref === 'PAY-2026-0822');
}

feature('S11.3 The role catalog is SoD-clean by construction');
then('no non-super role holds a forbidden pair', ROLE_CATALOG.filter((r) => r.id !== 'super_admin').every((role) =>
  SOD_FORBIDDEN.every(([a, b]) => !(role.permissions.includes(a) && role.permissions.includes(b)))));
then('every division has at least one admin', ['platform', 'mobility', 'property', 'hospitality', 'estate', 'finance', 'people', 'security'].every((d) => ADMINS.some((a) => a.division === d)));

// ===========================================================================
feature('S12.1 Offer beyond 50% cannot publish; corrected it can');
{
  const tooDeep = { ...SEED_OFFERS[0], kind: 'percent' as const, value: 100 };
  then('100% off is refused', offerIssues(tooDeep).length > 0);
  const ok = { ...tooDeep, value: 50 };
  then('50% publishes and reads live in-window', offerIssues(ok).length === 0 && offerEffectiveState(ok, '2026-08-25') === 'live');
  then('pausing beats the clock', offerEffectiveState({ ...ok, state: 'paused' }, '2026-08-25') === 'paused');
}

feature('S12.2 Hidden directory entries cannot be featured');
then('seeded data honours the invariant', SEED_DIRECTORY.filter((d) => d.featured).every((d) => d.visible));

// ===========================================================================
feature('Sanity: portfolio flagship still lists');
then('flagship compliant', canList(SEED_PROPERTIES[0] as ManagedProperty));

console.log(`scenarios (console): ${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
