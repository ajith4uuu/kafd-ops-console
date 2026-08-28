// Dine reservation-operations engine (pure module, unit-testable).
// End-to-end table management: floor plan + smart table assignment, a
// reservation book with a real status lifecycle, per-slot pacing caps,
// waitlist quoting, deposit / no-show policy economics, guest CRM tiers,
// ticketed experiences and the review-reply queue.

// ---------------------------------------------------------------- floor plan

export type FloorZone = 'indoor' | 'terrace' | 'bar';

export interface DineTable {
  id: string;
  label: string;
  zone: FloorZone;
  seats: number;
}

/** Il Baretto's floor — the book demo venue. */
export const TABLES: readonly DineTable[] = [
  { id: 't-01', label: 'T1', zone: 'indoor', seats: 2 },
  { id: 't-02', label: 'T2', zone: 'indoor', seats: 2 },
  { id: 't-03', label: 'T3', zone: 'indoor', seats: 4 },
  { id: 't-04', label: 'T4', zone: 'indoor', seats: 4 },
  { id: 't-05', label: 'T5', zone: 'indoor', seats: 6 },
  { id: 't-06', label: 'T6', zone: 'indoor', seats: 8 },
  { id: 't-07', label: 'P1', zone: 'terrace', seats: 2 },
  { id: 't-08', label: 'P2', zone: 'terrace', seats: 4 },
  { id: 't-09', label: 'P3', zone: 'terrace', seats: 4 },
  { id: 't-10', label: 'P4', zone: 'terrace', seats: 6 },
  { id: 't-11', label: 'B1', zone: 'bar', seats: 2 },
  { id: 't-12', label: 'B2', zone: 'bar', seats: 3 },
];

export function tableById(id: string): DineTable | undefined {
  return TABLES.find((t) => t.id === id);
}

// ---------------------------------------------------------------- reservations

export type ResStatus = 'booked' | 'confirmed' | 'seated' | 'finished' | 'no_show' | 'cancelled';

/** Legal transitions — the book can never skip a state or resurrect one. */
export const RES_TRANSITIONS: Readonly<Record<ResStatus, readonly ResStatus[]>> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'no_show', 'cancelled'],
  seated: ['finished'],
  finished: [],
  no_show: [],
  cancelled: [],
};

export function canTransition(from: ResStatus, to: ResStatus): boolean {
  return RES_TRANSITIONS[from].includes(to);
}

export interface Reservation {
  id: string;
  guestName: string;
  party: number;
  /** HH:MM seating time tonight. */
  time: string;
  status: ResStatus;
  tableId: string | null;
  zonePref?: FloorZone;
  notes?: string;
  depositPaidSar: number;
}

/** Turn time by party size — the window a table stays blocked. */
export function turnMinutes(party: number): number {
  return party <= 2 ? 90 : party <= 4 ? 105 : 120;
}

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Two seatings collide when their turn windows overlap on the same table. */
export function tableFreeAt(
  reservations: readonly Reservation[],
  tableId: string,
  time: string,
  party: number,
  ignoreId?: string,
): boolean {
  const start = toMin(time);
  const end = start + turnMinutes(party);
  return !reservations.some((r) => {
    if (r.id === ignoreId || r.tableId !== tableId) return false;
    if (r.status === 'cancelled' || r.status === 'no_show' || r.status === 'finished') return false;
    const rs = toMin(r.time);
    const re = rs + turnMinutes(r.party);
    return start < re && rs < end;
  });
}

/**
 * Smart assignment: the smallest free table that fits, preferring the guest's
 * zone — never burn an 8-top on a deuce. Null when the slot is truly full.
 */
export function suggestTable(
  reservations: readonly Reservation[],
  party: number,
  time: string,
  zonePref?: FloorZone,
  ignoreId?: string,
): DineTable | null {
  const fits = TABLES
    .filter((t) => t.seats >= party && tableFreeAt(reservations, t.id, time, party, ignoreId))
    .sort((a, b) => {
      const zoneDiff = Number(b.zone === zonePref) - Number(a.zone === zonePref);
      if (zoneDiff !== 0) return zoneDiff;
      return a.seats - b.seats;
    });
  return fits[0] ?? null;
}

/** Seatings allowed to START in any 15-minute slot — the pacing throttle. */
export const PACING_CAP_PER_SLOT = 4;

export function slotLoad(reservations: readonly Reservation[], time: string): number {
  const slot = Math.floor(toMin(time) / 15);
  return reservations.filter(
    (r) => r.status !== 'cancelled' && r.status !== 'no_show' && Math.floor(toMin(r.time) / 15) === slot,
  ).length;
}

export function pacingOk(reservations: readonly Reservation[], time: string): boolean {
  return slotLoad(reservations, time) < PACING_CAP_PER_SLOT;
}

/** First slot from `fromTime` with pacing room AND a fitting table — the waitlist quote. */
export function waitlistQuote(
  reservations: readonly Reservation[],
  party: number,
  fromTime: string,
): string | null {
  let m = Math.ceil(toMin(fromTime) / 15) * 15;
  for (; m <= 23 * 60; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const t = `${hh}:${mm}`;
    if (pacingOk(reservations, t) && suggestTable(reservations, party, t) != null) return t;
  }
  return null;
}

export const SEED_RESERVATIONS: readonly Reservation[] = [
  { id: 'rs-01', guestName: 'Al-Rashid, Layla', party: 2, time: '19:00', status: 'confirmed', tableId: 't-07', zonePref: 'terrace', notes: 'Anniversary — window if possible', depositPaidSar: 0 },
  { id: 'rs-02', guestName: 'Qahtani, Abdullah', party: 4, time: '19:00', status: 'confirmed', tableId: 't-03', depositPaidSar: 200 },
  { id: 'rs-03', guestName: 'Chen, Wei (JPMorgan)', party: 6, time: '19:30', status: 'booked', tableId: null, zonePref: 'indoor', notes: 'Client dinner', depositPaidSar: 300 },
  { id: 'rs-04', guestName: 'Al-Otaibi, Huda', party: 2, time: '19:30', status: 'confirmed', tableId: 't-01', depositPaidSar: 0 },
  { id: 'rs-05', guestName: 'Dossari, Majed', party: 3, time: '20:00', status: 'booked', tableId: null, depositPaidSar: 0 },
  { id: 'rs-06', guestName: 'Ghamdi, Sultan', party: 8, time: '20:00', status: 'confirmed', tableId: 't-06', notes: 'Birthday cake at dessert', depositPaidSar: 400 },
  { id: 'rs-07', guestName: 'Harbi, Mona', party: 2, time: '20:30', status: 'booked', tableId: null, zonePref: 'bar', depositPaidSar: 0 },
  { id: 'rs-08', guestName: 'Anazi, Tariq', party: 4, time: '18:30', status: 'seated', tableId: 't-04', depositPaidSar: 200 },
  { id: 'rs-09', guestName: 'Subaie, Khalid', party: 2, time: '18:00', status: 'finished', tableId: 't-02', depositPaidSar: 0 },
  { id: 'rs-10', guestName: 'Walk-in, Fahad', party: 5, time: '19:45', status: 'confirmed', tableId: 't-10', depositPaidSar: 250 },
];

export interface WaitlistEntry {
  id: string;
  guestName: string;
  party: number;
  askedAt: string;
}

export const SEED_WAITLIST: readonly WaitlistEntry[] = [
  { id: 'wl-01', guestName: 'Zahrani, Aisha', party: 2, askedAt: '19:10' },
  { id: 'wl-02', guestName: 'Mutairi, Rakan', party: 4, askedAt: '19:20' },
  { id: 'wl-03', guestName: 'Juhani, Salma', party: 6, askedAt: '19:25' },
];

// ---------------------------------------------------------------- deposits

export interface DepositPolicy {
  venueId: string;
  venue: string;
  /** Parties at or above this size pay a per-person deposit. */
  partyThreshold: number;
  perPersonSar: number;
  /** Free cancellation up to this many hours before the seating. */
  cancelWindowHours: number;
}

export const SEED_POLICIES: readonly DepositPolicy[] = [
  { venueId: 'il-baretto', venue: 'Il Baretto', partyThreshold: 4, perPersonSar: 50, cancelWindowHours: 24 },
  { venueId: 'benoit', venue: 'Benoit', partyThreshold: 4, perPersonSar: 50, cancelWindowHours: 24 },
  { venueId: 'zuma', venue: 'Zuma', partyThreshold: 2, perPersonSar: 100, cancelWindowHours: 48 },
];

export function policyIssues(p: DepositPolicy): string[] {
  const issues: string[] = [];
  if (p.partyThreshold < 1) issues.push('Threshold must be at least 1');
  if (p.perPersonSar < 0) issues.push('Deposit cannot be negative');
  if (p.perPersonSar > 300) issues.push('Deposits above SAR 300/person need super-admin sign-off');
  if (![24, 48].includes(p.cancelWindowHours)) issues.push('Cancellation window is 24h (casual) or 48h (destination dining)');
  return issues;
}

export function depositFor(policy: DepositPolicy, party: number): number {
  return party >= policy.partyThreshold ? party * policy.perPersonSar : 0;
}

/** A no-show forfeits the deposit; nothing is charged beyond what was held. */
export function noShowFee(reservation: Reservation): number {
  return reservation.depositPaidSar;
}

// ---------------------------------------------------------------- guest CRM

export interface GuestProfile {
  id: string;
  name: string;
  visits: number;
  lifetimeSpendSar: number;
  tags: string[];
  allergies: string[];
  lastVisit: string;
}

export type GuestTier = 'vip' | 'regular' | 'new';

export function guestTier(g: Pick<GuestProfile, 'visits' | 'lifetimeSpendSar'>): GuestTier {
  if (g.visits >= 10 || g.lifetimeSpendSar >= 8000) return 'vip';
  if (g.visits >= 3) return 'regular';
  return 'new';
}

export const SEED_GUESTS: readonly GuestProfile[] = [
  { id: 'g-01', name: 'Al-Rashid, Layla', visits: 14, lifetimeSpendSar: 11200, tags: ['Anniversary Aug 29', 'Prefers terrace'], allergies: [], lastVisit: '2026-08-14' },
  { id: 'g-02', name: 'Chen, Wei', visits: 6, lifetimeSpendSar: 9400, tags: ['Client dinners', 'JPMorgan RHQ'], allergies: ['Shellfish'], lastVisit: '2026-08-20' },
  { id: 'g-03', name: 'Ghamdi, Sultan', visits: 4, lifetimeSpendSar: 2800, tags: ['Birthday Aug 29'], allergies: [], lastVisit: '2026-07-30' },
  { id: 'g-04', name: 'Al-Otaibi, Huda', visits: 9, lifetimeSpendSar: 5100, tags: ['Quiet corner'], allergies: ['Nuts'], lastVisit: '2026-08-18' },
  { id: 'g-05', name: 'Harbi, Mona', visits: 2, lifetimeSpendSar: 640, tags: [], allergies: [], lastVisit: '2026-08-10' },
  { id: 'g-06', name: 'Dossari, Majed', visits: 1, lifetimeSpendSar: 310, tags: [], allergies: ['Gluten'], lastVisit: '2026-08-05' },
];

// ---------------------------------------------------------------- ticketed events

export interface DineEvent {
  id: string;
  title: string;
  venue: string;
  date: string;
  priceSar: number;
  seats: number;
  sold: number;
  state: 'draft' | 'on_sale' | 'sold_out' | 'closed';
}

export function eventIssues(e: DineEvent): string[] {
  const issues: string[] = [];
  if (!e.title.trim()) issues.push('Title is required');
  if (e.priceSar <= 0) issues.push('Ticketed events are prepaid — price must be positive');
  if (e.seats <= 0) issues.push('Seat count must be positive');
  if (e.sold > e.seats) issues.push('Sold cannot exceed capacity');
  return issues;
}

export function eventRevenue(e: DineEvent): number {
  return e.sold * e.priceSar;
}

export function eventSeatsLeft(e: DineEvent): number {
  return Math.max(0, e.seats - e.sold);
}

export const SEED_EVENTS: readonly DineEvent[] = [
  { id: 'ev-01', title: 'Truffle Night — 5 courses', venue: 'Il Baretto', date: '2026-09-04', priceSar: 480, seats: 40, sold: 34, state: 'on_sale' },
  { id: 'ev-02', title: 'Omakase Counter — 12 seats', venue: 'Zuma', date: '2026-09-11', priceSar: 950, seats: 12, sold: 12, state: 'sold_out' },
  { id: 'ev-03', title: 'Chef’s Harvest Table', venue: 'Benoit', date: '2026-09-18', priceSar: 420, seats: 30, sold: 9, state: 'on_sale' },
  { id: 'ev-04', title: 'National Day Brunch', venue: 'Apple Butter Café', date: '2026-09-23', priceSar: 260, seats: 60, sold: 0, state: 'draft' },
];

// ---------------------------------------------------------------- reviews

export interface GuestReview {
  id: string;
  venue: string;
  rating: number;
  excerpt: string;
  channel: 'google' | 'app' | 'opentable';
  ageHours: number;
  replied: boolean;
}

/** Reply SLA: negative reviews within 24h, everything else within 72h. */
export function reviewSlaHours(review: Pick<GuestReview, 'rating'>): number {
  return review.rating <= 3 ? 24 : 72;
}

export function reviewBreached(review: GuestReview): boolean {
  return !review.replied && review.ageHours > reviewSlaHours(review);
}

export const SEED_REVIEWS: readonly GuestReview[] = [
  { id: 'rv-01', venue: 'Il Baretto', rating: 5, excerpt: 'The terrace at sunset is unbeatable — service impeccable.', channel: 'app', ageHours: 4, replied: false },
  { id: 'rv-02', venue: 'Benoit', rating: 2, excerpt: 'Waited 35 minutes past our reservation time.', channel: 'google', ageHours: 20, replied: false },
  { id: 'rv-03', venue: 'Zuma', rating: 4, excerpt: 'Excellent robata, slightly rushed dessert.', channel: 'opentable', ageHours: 30, replied: true },
  { id: 'rv-04', venue: 'Il Baretto', rating: 3, excerpt: 'Food great, music too loud for a business dinner.', channel: 'google', ageHours: 26, replied: false },
  { id: 'rv-05', venue: 'Apple Butter Café', rating: 5, excerpt: 'Best shakshuka in Riyadh, period.', channel: 'app', ageHours: 90, replied: true },
];
