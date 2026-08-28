// Dine reservation-ops engine tests (run: npx tsx scripts/dineops.test.ts)
import {
  PACING_CAP_PER_SLOT,
  RES_TRANSITIONS,
  SEED_EVENTS,
  SEED_GUESTS,
  SEED_POLICIES,
  SEED_RESERVATIONS,
  SEED_REVIEWS,
  SEED_WAITLIST,
  TABLES,
  canTransition,
  depositFor,
  eventIssues,
  eventRevenue,
  eventSeatsLeft,
  guestTier,
  noShowFee,
  pacingOk,
  policyIssues,
  reviewBreached,
  reviewSlaHours,
  slotLoad,
  suggestTable,
  tableFreeAt,
  turnMinutes,
  waitlistQuote,
  type Reservation,
} from '../src/data/dineops';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// --- floor plan ---
assert('12 tables on the floor', TABLES.length === 12);
assert('three zones populated', (['indoor', 'terrace', 'bar'] as const).every((z) => TABLES.some((t) => t.zone === z)));
assert('capacities span 2..8', Math.min(...TABLES.map((t) => t.seats)) === 2 && Math.max(...TABLES.map((t) => t.seats)) === 8);

// --- lifecycle ---
assert('booked can confirm or cancel only', RES_TRANSITIONS.booked.join(',') === 'confirmed,cancelled');
assert('confirmed can seat, no-show or cancel', canTransition('confirmed', 'seated') && canTransition('confirmed', 'no_show') && canTransition('confirmed', 'cancelled'));
assert('seated can only finish', RES_TRANSITIONS.seated.length === 1 && canTransition('seated', 'finished'));
assert('finished is terminal', RES_TRANSITIONS.finished.length === 0);
assert('cannot seat a booked party (must confirm first)', !canTransition('booked', 'seated'));
assert('cannot resurrect a no-show', RES_TRANSITIONS.no_show.length === 0);

// --- turn times & conflicts ---
assert('deuce turns in 90', turnMinutes(2) === 90);
assert('four-top turns in 105', turnMinutes(4) === 105);
assert('big party turns in 120', turnMinutes(6) === 120);
const book = SEED_RESERVATIONS;
assert('T4 blocked at 19:00 (Anazi seated 18:30 turns to 20:15)', !tableFreeAt(book, 't-04', '19:00', 2));
assert('T4 free at 20:30', tableFreeAt(book, 't-04', '20:30', 2));
assert('finished table frees up (T2 18:00 finished)', tableFreeAt(book, 't-02', '19:00', 2));
assert('own reservation ignored via ignoreId', tableFreeAt(book, 't-07', '19:00', 2, 'rs-01'));

// --- smart assignment ---
const forSix = suggestTable(book, 6, '19:30', 'indoor');
assert('6-top at 19:30 gets the smallest fitting free table', forSix != null && forSix.seats >= 6);
assert('deuce never burns a big table when a deuce is free', (suggestTable(book, 2, '21:30') ?? { seats: 99 }).seats === 2);
const terracePref = suggestTable(book, 4, '21:30', 'terrace');
assert('zone preference honoured when free', terracePref?.zone === 'terrace');
assert('impossible party returns null', suggestTable(book, 9, '19:00') === null);

// --- pacing ---
assert('pacing cap is 4 per 15-min slot', PACING_CAP_PER_SLOT === 4);
assert('19:00 slot holds 2 seatings', slotLoad(book, '19:00') === 2);
assert('19:00 has pacing room', pacingOk(book, '19:00'));
const packed: Reservation[] = [
  ...book,
  { id: 'x1', guestName: 'a', party: 2, time: '19:00', status: 'confirmed', tableId: null, depositPaidSar: 0 },
  { id: 'x2', guestName: 'b', party: 2, time: '19:05', status: 'confirmed', tableId: null, depositPaidSar: 0 },
];
assert('cap refuses the fifth seating in a slot', !pacingOk(packed, '19:10'));
assert('cancelled rows never count toward pacing', slotLoad([{ id: 'c', guestName: 'c', party: 2, time: '22:00', status: 'cancelled', tableId: null, depositPaidSar: 0 }], '22:00') === 0);

// --- waitlist quoting ---
const quote = waitlistQuote(book, 2, '19:10');
assert('waitlist quote lands on a 15-min boundary', quote != null && Number(quote.slice(3)) % 15 === 0);
assert('quote is at or after asking time', quote != null && quote >= '19:15');
assert('quote slot really has room + a table', quote != null && pacingOk(book, quote) && suggestTable(book, 2, quote) != null);
assert('impossible party quotes null', waitlistQuote(book, 9, '19:00') === null);
assert('3 waitlist entries seeded', SEED_WAITLIST.length === 3);

// --- deposits & no-shows ---
const ilb = SEED_POLICIES[0];
assert('3 venue policies seeded, all valid', SEED_POLICIES.length === 3 && SEED_POLICIES.every((p) => policyIssues(p).length === 0));
assert('party under threshold pays nothing', depositFor(ilb, 3) === 0);
assert('party of 4 pays 4 x 50', depositFor(ilb, 4) === 200);
assert('Zuma holds from party of 2 at 100pp', depositFor(SEED_POLICIES[2], 2) === 200);
assert('no-show forfeits exactly the deposit held', noShowFee(SEED_RESERVATIONS[1]) === 200);
assert('no deposit means no fee', noShowFee(SEED_RESERVATIONS[0]) === 0);
assert('cancellation window must be 24 or 48', policyIssues({ ...ilb, cancelWindowHours: 12 }).length === 1);
assert('deposits above 300pp escalate', policyIssues({ ...ilb, perPersonSar: 350 }).some((i) => i.includes('super-admin')));
assert('seeded deposits match policy math', SEED_RESERVATIONS.filter((r) => r.party >= 4).every((r) => r.depositPaidSar === depositFor(ilb, r.party)));

// --- guest CRM ---
assert('6 guest profiles', SEED_GUESTS.length === 6);
assert('Layla is VIP by visits', guestTier(SEED_GUESTS[0]) === 'vip');
assert('Chen is VIP by spend', guestTier(SEED_GUESTS[1]) === 'vip');
assert('Sultan is regular', guestTier(SEED_GUESTS[2]) === 'regular');
assert('Majed is new', guestTier(SEED_GUESTS[5]) === 'new');
assert('allergies captured', SEED_GUESTS.some((g) => g.allergies.includes('Shellfish')));

// --- ticketed events ---
assert('4 events seeded, all valid', SEED_EVENTS.length === 4 && SEED_EVENTS.every((e) => eventIssues(e).length === 0));
assert('free events rejected (prepaid only)', eventIssues({ ...SEED_EVENTS[0], priceSar: 0 }).some((i) => i.includes('prepaid')));
assert('overselling rejected', eventIssues({ ...SEED_EVENTS[0], sold: 41 }).some((i) => i.includes('capacity')));
assert('truffle night revenue', eventRevenue(SEED_EVENTS[0]) === 34 * 480);
assert('omakase is sold out with 0 left', eventSeatsLeft(SEED_EVENTS[1]) === 0 && SEED_EVENTS[1].state === 'sold_out');
assert('seats left math', eventSeatsLeft(SEED_EVENTS[2]) === 21);

// --- reviews ---
assert('negative reviews get the 24h SLA', reviewSlaHours({ rating: 2 }) === 24 && reviewSlaHours({ rating: 3 }) === 24);
assert('positive reviews get 72h', reviewSlaHours({ rating: 5 }) === 72);
assert('unreplied 2-star at 20h not yet breached', !reviewBreached(SEED_REVIEWS[1]));
assert('unreplied 3-star at 26h IS breached', reviewBreached(SEED_REVIEWS[3]));
assert('replied reviews never breach', !reviewBreached(SEED_REVIEWS[4]));
assert('exactly one seeded breach', SEED_REVIEWS.filter(reviewBreached).length === 1);

console.log(`dineops: ${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
