// KAFD Ops Console — deterministic operational dataset.
// A seeded PRNG generates 90 days of cross-pillar history (rides, orders,
// reservations, leases, maintenance, incidents, concierge sessions, audit
// trail) so every load shows identical, believable numbers. In production
// this layer is replaced by the services/* read APIs + ClickHouse.

export const DAYS = 90;
/** Console "today" — aligned with the mobile demo epoch. */
export const TODAY = new Date('2026-08-21T12:00:00');

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260821);
export const R = {
  next: () => rand(),
  int: (min: number, max: number) => min + Math.floor(rand() * (max - min + 1)),
  pick: <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)],
  chance: (p: number) => rand() < p,
  round2: (v: number) => Math.round(v * 100) / 100,
};

export function dayKey(offsetFromStart: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (DAYS - 1) + offsetFromStart);
  return d.toISOString().slice(0, 10);
}

export const DAY_KEYS = Array.from({ length: DAYS }, (_, i) => dayKey(i));
export const TODAY_KEY = DAY_KEYS[DAYS - 1];

/** Weekday of a day key (0=Sun). Fri/Sat are the KSA weekend. */
export function weekday(key: string): number {
  return new Date(`${key}T12:00:00`).getDay();
}
const isWeekend = (key: string) => [5, 6].includes(weekday(key));

// ------------------------------------------------------------------ entities

export interface Venue {
  id: string;
  name: string;
  cuisine: string;
  tables: number;
  bookable: boolean;
}

export const VENUES: readonly Venue[] = [
  { id: 'il-baretto', name: 'Il Baretto', cuisine: 'Italian', tables: 12, bookable: true },
  { id: 'benoit', name: 'Benoit', cuisine: 'French', tables: 14, bookable: true },
  { id: 'kanto', name: 'Kanto', cuisine: 'Asian', tables: 9, bookable: true },
  { id: 'apple-butter', name: 'Apple Butter Café', cuisine: 'Brunch', tables: 12, bookable: true },
  { id: '12-cups', name: '12 Cups', cuisine: 'Coffee', tables: 10, bookable: true },
  { id: 'atlas-cafe', name: 'Atlas Cafe', cuisine: 'Café', tables: 8, bookable: true },
  { id: 'pistrina', name: 'Pistrina Bakery', cuisine: 'Bakery', tables: 7, bookable: true },
];

export interface Driver {
  id: string;
  name: string;
  gender: 'male' | 'female';
  rating: number;
  acceptance: number;
  cancellation: number;
  trips90d: number;
  status: 'active' | 'review' | 'suspended';
}

const DRIVER_NAMES: [string, 'male' | 'female'][] = [
  ['Fahad M.', 'male'], ['Omar A.', 'male'], ['Noura S.', 'female'], ['Sara H.', 'female'],
  ['Khalid R.', 'male'], ['Yousef T.', 'male'], ['Aisha B.', 'female'], ['Majed K.', 'male'],
  ['Lama F.', 'female'], ['Turki S.', 'male'], ['Rana Q.', 'female'], ['Saad N.', 'male'],
];

export const DRIVERS: readonly Driver[] = DRIVER_NAMES.map(([name, gender], i) => ({
  id: `drv-${i + 1}`,
  name,
  gender,
  rating: R.round2(4.5 + R.next() * 0.5),
  acceptance: R.int(82, 99),
  cancellation: R.int(0, 6),
  trips90d: R.int(180, 720),
  status: i === 7 ? 'review' : i === 11 ? 'suspended' : 'active',
}));

export interface Merchant {
  id: string;
  name: string;
  category: 'food' | 'coffee' | 'pharmacy' | 'gifts';
  prepMin: number;
  rating: number;
}

export const MERCHANTS: readonly Merchant[] = [
  { id: 'go-12-cups', name: '12 Cups', category: 'coffee', prepMin: 8, rating: 4.9 },
  { id: 'go-apple-butter', name: 'Apple Butter', category: 'food', prepMin: 16, rating: 4.7 },
  { id: 'go-pistrina', name: 'Pistrina', category: 'food', prepMin: 12, rating: 4.8 },
  { id: 'go-kanto', name: 'Kanto', category: 'food', prepMin: 18, rating: 4.6 },
  { id: 'go-kunooz', name: 'Kunooz Pharmacy', category: 'pharmacy', prepMin: 6, rating: 4.8 },
  { id: 'go-bateel', name: 'Bateel', category: 'gifts', prepMin: 10, rating: 4.9 },
];

export interface Building {
  code: string;
  units: number;
  leased: number;
  reserved: number;
  walkthroughCoverage: number;
}

export const BUILDINGS: readonly Building[] = [
  { code: '3.04', units: 80, leased: 64, reserved: 5, walkthroughCoverage: 100 },
  { code: '3.05', units: 48, leased: 41, reserved: 2, walkthroughCoverage: 100 },
  { code: '5.07', units: 29, leased: 21, reserved: 3, walkthroughCoverage: 93 },
];

// ------------------------------------------------------------- daily series

export type RideClass = 'pool' | 'go' | 'comfort' | 'xl' | 'ladies';
export const RIDE_CLASSES: readonly RideClass[] = ['pool', 'go', 'comfort', 'xl', 'ladies'];

export interface DailyRides {
  day: string;
  byClass: Record<RideClass, number>;
  total: number;
  poolMatched: number;
  gmv: number;
  co2Kg: number;
  pickupEtaP50: number;
  pickupEtaP95: number;
  surgePeak: number;
  sosCount: number;
  cancellations: number;
}

export interface DailyOrders {
  day: string;
  orders: number;
  deskShare: number;
  gmv: number;
  medianDeliveryMin: number;
  p90DeliveryMin: number;
  issues: number;
  courierUtilization: number;
}

export interface DailyDine {
  day: string;
  covers: number;
  reservations: number;
  noShows: number;
  waitlistJoins: number;
  waitlistClaims: number;
  deposits: number;
}

export interface DailyAi {
  day: string;
  sessions: number;
  toolCalls: number;
  toolSuccess: number;
  arShare: number;
  transactionsInitiated: number;
  costSar: number;
}

function growth(i: number): number {
  return 0.55 + (i / DAYS) * 0.6; // adoption ramp over the quarter
}

export const RIDES_DAILY: readonly DailyRides[] = DAY_KEYS.map((day, i) => {
  const g = growth(i);
  const weekend = isWeekend(day);
  const base = weekend ? 46 : 88;
  const total = Math.round(base * g + R.int(-6, 8));
  const pool = Math.round(total * (0.34 + R.next() * 0.08));
  const go = Math.round(total * 0.31);
  const comfort = Math.round(total * 0.13);
  const xl = Math.round(total * 0.07);
  const ladies = Math.max(0, total - pool - go - comfort - xl);
  const poolMatched = Math.round(pool * (0.52 + R.next() * 0.14 + (i / DAYS) * 0.08));
  const avgKm = 4.6 + R.next() * 2;
  return {
    day,
    byClass: { pool, go, comfort, xl, ladies },
    total,
    poolMatched,
    gmv: R.round2(total * (11 + R.next() * 6)),
    co2Kg: R.round2(pool * avgKm * 0.12),
    pickupEtaP50: R.round2(3.4 + R.next() * 2 + (weekend ? -0.5 : 0.6)),
    pickupEtaP95: R.round2(7 + R.next() * 4),
    surgePeak: weekend ? 1 : R.pick([1, 1, 1.2, 1.4, 1.5]),
    sosCount: R.chance(0.06) ? 1 : 0,
    cancellations: R.int(1, Math.max(2, Math.round(total * 0.06))),
  };
});

export const ORDERS_DAILY: readonly DailyOrders[] = DAY_KEYS.map((day, i) => {
  const g = growth(i);
  const weekend = isWeekend(day);
  const orders = Math.round((weekend ? 34 : 72) * g + R.int(-5, 7));
  return {
    day,
    orders,
    deskShare: R.round2(weekend ? 0.22 + R.next() * 0.1 : 0.55 + R.next() * 0.12),
    gmv: R.round2(orders * (52 + R.next() * 18)),
    medianDeliveryMin: R.round2(14.5 + R.next() * 4 - (i / DAYS) * 2),
    p90DeliveryMin: R.round2(22 + R.next() * 6),
    issues: R.chance(0.5) ? R.int(0, Math.max(1, Math.round(orders * 0.035))) : 0,
    courierUtilization: R.round2(0.46 + R.next() * 0.18 + (i / DAYS) * 0.06),
  };
});

export const DINE_DAILY: readonly DailyDine[] = DAY_KEYS.map((day, i) => {
  const g = growth(i);
  const weekend = isWeekend(day);
  const reservations = Math.round((weekend ? 58 : 40) * g + R.int(-4, 6));
  const covers = Math.round(reservations * (2.4 + R.next() * 0.8));
  const noShows = Math.round(reservations * (0.1 - (i / DAYS) * 0.045 + R.next() * 0.02));
  const waitlistJoins = R.int(4, weekend ? 22 : 12);
  return {
    day,
    covers,
    reservations,
    noShows,
    waitlistJoins,
    waitlistClaims: Math.round(waitlistJoins * (0.55 + R.next() * 0.2)),
    deposits: Math.round(reservations * 0.18),
  };
});

export const AI_DAILY: readonly DailyAi[] = DAY_KEYS.map((day, i) => {
  const g = growth(i);
  const sessions = Math.round(60 * g + R.int(-6, 10));
  const toolCalls = Math.round(sessions * (1.7 + R.next() * 0.5));
  return {
    day,
    sessions,
    toolCalls,
    toolSuccess: Math.round(toolCalls * (0.93 + R.next() * 0.05)),
    arShare: R.round2(0.42 + R.next() * 0.14),
    transactionsInitiated: Math.round(sessions * (0.2 + (i / DAYS) * 0.14)),
    costSar: R.round2(toolCalls * (0.028 + R.next() * 0.012)),
  };
});

// --------------------------------------------------------------- pacing heat

/** Dine pacing heatmap: seatings started per venue per dinner hour (17..23). */
export const DINE_HOURS = [12, 13, 14, 17, 18, 19, 20, 21, 22] as const;
export const DINE_PACING: readonly { venueId: string; hour: number; seatings: number }[] = VENUES.flatMap(
  (venue) =>
    DINE_HOURS.map((hour) => ({
      venueId: venue.id,
      hour,
      seatings:
        hour >= 19 && hour <= 21
          ? R.int(Math.round(venue.tables * 0.5), venue.tables + 3)
          : hour >= 12 && hour <= 13
            ? R.int(2, Math.round(venue.tables * 0.7))
            : R.int(0, Math.round(venue.tables * 0.45)),
    })),
);

// ------------------------------------------------------------- work orders

export type WoPriority = 'P1' | 'P2' | 'P3';
export type WoStatus = 'open' | 'scheduled' | 'in_progress' | 'resolved';

export interface WorkOrder {
  id: string;
  building: string;
  unit: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'general';
  priority: WoPriority;
  status: WoStatus;
  vendor: string;
  openedDay: string;
  responseHours: number;
  slaHours: number;
}

const WO_VENDORS: Record<WorkOrder['category'], string> = {
  plumbing: 'Aquafix Plumbing Co.',
  electrical: 'Volt Masters',
  hvac: 'CoolAir HVAC Services',
  appliance: 'HomeTech Appliance Care',
  general: 'KAFD Building Services',
};

export const WORK_ORDERS: readonly WorkOrder[] = Array.from({ length: 64 }, (_, i) => {
  const category = R.pick(['plumbing', 'electrical', 'hvac', 'hvac', 'appliance', 'general'] as const);
  const priority: WoPriority = category === 'plumbing' && R.chance(0.25) ? 'P1' : R.pick(['P2', 'P2', 'P3'] as const);
  const slaHours = priority === 'P1' ? 2 : priority === 'P2' ? 24 : 72;
  const withinSla = R.chance(priority === 'P1' ? 0.9 : 0.86);
  const building = R.pick(BUILDINGS).code;
  return {
    id: `WO-${1200 + i}`,
    building,
    unit: `${building}-${R.int(3, 22)}${String(R.int(1, 8)).padStart(2, '0')}`,
    category,
    priority,
    status: R.pick(['resolved', 'resolved', 'resolved', 'in_progress', 'scheduled', 'open'] as const),
    vendor: WO_VENDORS[category],
    openedDay: R.pick(DAY_KEYS.slice(-30)),
    responseHours: R.round2(withinSla ? slaHours * (0.2 + R.next() * 0.7) : slaHours * (1.1 + R.next() * 0.8)),
    slaHours,
  };
});

export interface Invoice {
  id: string;
  building: string;
  unit: string;
  amount: number;
  dueDay: string;
  agingDays: number;
  status: 'paid' | 'due' | 'overdue';
}

export const RENT_INVOICES: readonly Invoice[] = Array.from({ length: 120 }, (_, i) => {
  const building = R.pick(BUILDINGS).code;
  const status = R.pick(['paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'due', 'due', 'overdue'] as const);
  return {
    id: `INV-${5300 + i}`,
    building,
    unit: `${building}-${R.int(3, 22)}${String(R.int(1, 8)).padStart(2, '0')}`,
    amount: R.int(24, 95) * 1000,
    dueDay: R.pick(DAY_KEYS.slice(-45)),
    agingDays: status === 'overdue' ? R.int(4, 62) : status === 'due' ? R.int(-14, 0) : 0,
    status,
  };
});

// ----------------------------------------------------------------- incidents

export interface Incident {
  id: string;
  day: string;
  time: string;
  kind: 'sos' | 'route_deviation' | 'courier_access' | 'no_show_dispute' | 'refund_abuse';
  pillar: 'rafiq' | 'go' | 'dine';
  summary: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
}

const INCIDENT_SEEDS: [Incident['kind'], Incident['pillar'], string, Incident['severity']][] = [
  ['sos', 'rafiq', 'Rider SOS — resolved with KAFD Security callback', 'high'],
  ['route_deviation', 'rafiq', 'Route deviation >500m near Gate 4 — rider confirmed OK', 'medium'],
  ['courier_access', 'go', 'Tower security refused courier at 4.07 — lobby fallback used', 'medium'],
  ['no_show_dispute', 'dine', 'No-show fee dispute — Benoit party of 6', 'low'],
  ['refund_abuse', 'go', 'Repeat refund pattern flagged on account #8841', 'medium'],
  ['sos', 'rafiq', 'Driver SOS false alarm — pocket activation', 'low'],
  ['courier_access', 'go', 'Freight lift down in 3.05 — desk deliveries delayed 12 min', 'medium'],
  ['route_deviation', 'rafiq', 'GPS loss in KAFD 1 basement — dead-reckon recovered', 'low'],
];

export const INCIDENTS: readonly Incident[] = Array.from({ length: 14 }, (_, i) => {
  const [kind, pillar, summary, severity] = INCIDENT_SEEDS[i % INCIDENT_SEEDS.length];
  return {
    id: `INC-${240 + i}`,
    day: R.pick(DAY_KEYS.slice(-21)),
    time: `${String(R.int(7, 23)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}`,
    kind,
    pillar,
    summary,
    severity,
    status: i < 2 ? 'open' : i < 5 ? 'investigating' : 'resolved',
  };
});

// -------------------------------------------------------------------- audit

export interface AuditEntry {
  id: string;
  day: string;
  time: string;
  actor: string;
  role: 'ops_admin' | 'merchant' | 'leasing_agent' | 'system' | 'security';
  pillar: 'dine' | 'rafiq' | 'go' | 'living' | 'ai' | 'platform';
  action: string;
  entity: string;
  channel: 'console' | 'portal' | 'api' | 'automation';
}

const AUDIT_ACTORS: [string, AuditEntry['role']][] = [
  ['a.alqahtani', 'ops_admin'], ['m.alharbi', 'ops_admin'], ['benoit.mgr', 'merchant'],
  ['ilbaretto.mgr', 'merchant'], ['s.leasing', 'leasing_agent'], ['n.leasing', 'leasing_agent'],
  ['dispatch-bot', 'system'], ['pricing-bot', 'system'], ['gate-sec-12', 'security'],
];

const AUDIT_TEMPLATES: [AuditEntry['pillar'], string, string, AuditEntry['channel']][] = [
  ['dine', 'reservation.override_pacing', 'Benoit · 20:00 slot', 'portal'],
  ['dine', 'no_show_fee.waived', 'RSV-{n}', 'portal'],
  ['dine', 'blackout.created', 'Il Baretto · private event', 'portal'],
  ['rafiq', 'surge.cap_applied', 'H3 cell 8843 → 1.5x', 'automation'],
  ['rafiq', 'driver.document_verified', 'DRV-{n} istimara', 'console'],
  ['rafiq', 'flat_fare.updated', 'gate↔tower SAR 7', 'console'],
  ['rafiq', 'incident.closed', 'INC-{n}', 'console'],
  ['go', 'merchant.item_86d', 'Shakshuka Skillet', 'portal'],
  ['go', 'refund.partial_issued', 'ORD-{n} · SAR 18', 'console'],
  ['go', 'courier.badge_issued', 'CR-{n} tower access', 'console'],
  ['living', 'lease.esigned', 'Unit 3.04-{n}', 'api'],
  ['living', 'workorder.vendor_assigned', 'WO-{n} → CoolAir', 'console'],
  ['living', 'walkthrough.approved', 'Unit 5.07-{n} video', 'portal'],
  ['living', 'visitor_pass.revoked', 'VP-{n}', 'console'],
  ['ai', 'prompt.version_promoted', 'concierge@v{n}', 'console'],
  ['ai', 'tool_allowlist.updated', 'role:guest −living.pay_rent', 'console'],
  ['platform', 'role.granted', 'u.{n} → leasing_agent', 'console'],
  ['platform', 'export.generated', 'PDPL data-subject report', 'console'],
];

export const AUDIT_LOG: readonly AuditEntry[] = Array.from({ length: 400 }, (_, i) => {
  const [pillar, action, entityTemplate, channel] = R.pick(AUDIT_TEMPLATES);
  const [actor, role] = R.pick(AUDIT_ACTORS);
  return {
    id: `AUD-${9000 + i}`,
    day: R.pick(DAY_KEYS.slice(-30)),
    time: `${String(R.int(0, 23)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}`,
    actor,
    role,
    pillar,
    action,
    entity: entityTemplate.replace('{n}', String(R.int(100, 999))),
    channel,
  };
}).sort((a, b) => `${b.day}${b.time}`.localeCompare(`${a.day}${a.time}`));

// -------------------------------------------- scheduled rides & work program

// Isolated PRNG so adding this section never shifts the existing dataset.
const rand2 = mulberry32(20260921);
const R2 = {
  next: () => rand2(),
  int: (min: number, max: number) => min + Math.floor(rand2() * (max - min + 1)),
  round2: (v: number) => Math.round(v * 100) / 100,
};

export interface DailyScheduled {
  day: string;
  /** Reservations whose pickup fell on this day. */
  reserved: number;
  completed: number;
  /** Cancelled ≥60 min before pickup (free). */
  freeCancels: number;
  /** Cancelled inside 60 min (SAR 10 fee). */
  lateCancels: number;
  /** % of completed pickups where the captain arrived inside the 10-min window. */
  onTimePct: number;
  /** Work-tagged trips (on-demand + scheduled) that day. */
  workTrips: number;
  workGmv: number;
}

export const SCHEDULED_DAILY: readonly DailyScheduled[] = DAY_KEYS.map((day, i) => {
  const g = growth(i);
  const weekend = isWeekend(day);
  const rides = RIDES_DAILY[i];
  // Reservations ramp harder than on-demand — the feature launched mid-quarter.
  const launched = i >= 25;
  const reserved = launched ? Math.round((weekend ? 5 : 14) * g + R2.int(-2, 3)) : 0;
  const freeCancels = launched ? Math.round(reserved * (0.06 + R2.next() * 0.05)) : 0;
  const lateCancels = launched && R2.next() < 0.55 ? R2.int(0, Math.max(1, Math.round(reserved * 0.05))) : 0;
  const completed = Math.max(0, reserved - freeCancels - lateCancels);
  // Work rides skew to weekdays; share grows with corporate onboarding.
  const workShare = weekend ? 0.05 : 0.16 + (i / DAYS) * 0.1 + R2.next() * 0.04;
  const workTrips = Math.round(rides.total * workShare);
  return {
    day,
    reserved,
    completed,
    freeCancels,
    lateCancels,
    onTimePct: launched ? R2.round2(88 + R2.next() * 10 + (i / DAYS) * 2) : 0,
    workTrips,
    workGmv: R2.round2(workTrips * (16 + R2.next() * 9)),
  };
});

export interface CorporateAccount {
  id: string;
  company: string;
  riders: number;
  workTrips30d: number;
  workGmv30d: number;
  expenseProvider: 'SAP Concur' | 'Expensify' | 'Zoho Expense' | 'Qoyod' | '—';
  status: 'active' | 'onboarding';
}

const CORPORATE_SEEDS: [string, CorporateAccount['expenseProvider'], CorporateAccount['status']][] = [
  ['PIF Portfolio Services', 'SAP Concur', 'active'],
  ['Riyad Capital', 'SAP Concur', 'active'],
  ['SNB Digital', 'Expensify', 'active'],
  ['KAFD DMC', 'Qoyod', 'active'],
  ['Deloitte KSA', 'SAP Concur', 'active'],
  ['stc pay', 'Zoho Expense', 'active'],
  ['Alinma Ventures', 'Qoyod', 'onboarding'],
  ['Bain Riyadh Hub', '—', 'onboarding'],
];

export const CORPORATE_ACCOUNTS: readonly CorporateAccount[] = CORPORATE_SEEDS.map(([company, expenseProvider, status], i) => {
  const riders = status === 'active' ? R2.int(18, 120) : R2.int(4, 16);
  const workTrips30d = status === 'active' ? riders * R2.int(3, 9) : R2.int(6, 40);
  return {
    id: `corp-${i + 1}`,
    company,
    riders,
    workTrips30d,
    workGmv30d: R2.round2(workTrips30d * (15 + R2.next() * 10)),
    expenseProvider,
    status,
  };
});

// --------------------------------------------------------- live feed (today)

export interface LiveEvent {
  time: string;
  pillar: 'dine' | 'rafiq' | 'go' | 'living' | 'ai';
  text: string;
}

export const LIVE_FEED: readonly LiveEvent[] = [
  { time: '11:58', pillar: 'rafiq', text: 'Pool matched — Gate 3 → PIF Tower, 2 riders, 1.1 kg CO₂ saved' },
  { time: '11:56', pillar: 'go', text: 'Desk delivery completed 3.05 · L12 in 14 min (PIN verified)' },
  { time: '11:54', pillar: 'dine', text: 'Waitlist claim — Apple Butter, party of 2 seated' },
  { time: '11:51', pillar: 'ai', text: 'Concierge booked Il Baretto 20:00 ×4 (AR session)' },
  { time: '11:47', pillar: 'living', text: 'Viewing checked in — Unit 3.04-1802 (video)' },
  { time: '11:45', pillar: 'go', text: 'Courier batch of 3 dispatched from 12 Cups' },
  { time: '11:41', pillar: 'rafiq', text: 'Ladies ride completed — Noura S. ★5' },
  { time: '11:38', pillar: 'living', text: 'P2 work order WO-1263 assigned to CoolAir HVAC' },
  { time: '11:33', pillar: 'dine', text: 'Deposit captured — Benoit no-show (SAR 50)' },
  { time: '11:29', pillar: 'ai', text: 'Plan-my-evening approved: dinner + ride + parking' },
];
