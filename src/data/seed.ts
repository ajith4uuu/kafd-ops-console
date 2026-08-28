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

// ------------------------------------------------- Rafiq unit economics

// Isolated PRNG: adding economics never shifts the existing dataset.
const rand4 = mulberry32(20261021);
const R4 = {
  next: () => rand4(),
  round2: (v: number) => Math.round(v * 100) / 100,
};

/** Platform take on GMV; drivers keep the rest. */
export const RAFIQ_TAKE_RATE = 0.22;
/** Guaranteed driver floor per KAFD-subsidized flat-fare ride (SAR). */
export const FLAT_DRIVER_FLOOR_SAR = 9;

export interface DailyRafiqEcon {
  day: string;
  /** Intra-KAFD flat-fare rides vs metered city rides (sums to total). */
  flatRides: number;
  meteredRides: number;
  flatGmv: number;
  meteredGmv: number;
  /** Driver earnings incl. the flat-ride floor top-up. */
  driverPayout: number;
  /** KAFD top-up so flat-ride drivers always earn the floor. */
  subsidyCost: number;
  /** Platform net = take on GMV − subsidy. */
  netRevenue: number;
  tips: number;
  /** Share of that day's riders with a Nafath-verified identity. */
  nafathVerifiedShare: number;
}

export const RAFIQ_ECON_DAILY: readonly DailyRafiqEcon[] = DAY_KEYS.map((day, i) => {
  const rides = RIDES_DAILY[i];
  const flatShare = 0.52 + R4.next() * 0.12; // most trips stay inside the district
  const flatRides = Math.round(rides.total * flatShare);
  const meteredRides = rides.total - flatRides;
  // Flat fares average ~SAR 8.4/ride; the metered remainder carries the GMV.
  const flatGmv = Math.min(rides.gmv, R4.round2(flatRides * (7.8 + R4.next() * 1.2)));
  const meteredGmv = R4.round2(rides.gmv - flatGmv);
  const grossTake = R4.round2(rides.gmv * RAFIQ_TAKE_RATE);
  const flatDriverEarnings = R4.round2(flatGmv * (1 - RAFIQ_TAKE_RATE));
  const flatFloor = flatRides * FLAT_DRIVER_FLOOR_SAR;
  const subsidyCost = R4.round2(Math.max(0, flatFloor - flatDriverEarnings));
  const driverPayout = R4.round2(meteredGmv * (1 - RAFIQ_TAKE_RATE) + Math.max(flatDriverEarnings, flatFloor));
  const tips = R4.round2(rides.total * (0.4 + R4.next() * 0.5));
  return {
    day,
    flatRides,
    meteredRides,
    flatGmv,
    meteredGmv,
    driverPayout,
    subsidyCost,
    netRevenue: R4.round2(grossTake - subsidyCost),
    tips,
    nafathVerifiedShare: R4.round2(Math.min(0.9, 0.22 + (i / DAYS) * 0.5 + R4.next() * 0.05)),
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

// ------------------------------------- property compliance & short stays

// Isolated PRNG: this section never shifts the existing dataset.
const rand5 = mulberry32(20261122);
const R5 = {
  next: () => rand5(),
  int: (min: number, max: number) => min + Math.floor(rand5() * (max - min + 1)),
  pick: <T,>(items: readonly T[]): T => items[Math.floor(rand5() * items.length)],
  round2: (v: number) => Math.round(v * 100) / 100,
};

export interface EjarContract {
  id: string;
  building: string;
  unit: string;
  annualRent: number;
  /** Deposit held — the legal cap is 5% of the lease value. */
  depositSar: number;
  status: 'registered' | 'pending' | 'renewal_due';
  registeredDay: string;
}

export const EJAR_CONTRACTS: readonly EjarContract[] = Array.from({ length: 26 }, (_, i) => {
  const building = R5.pick(BUILDINGS).code;
  const annualRent = R5.int(96, 380) * 1000;
  return {
    id: `EJR-${5200 + i * 7}-${100000 + i * 991}`,
    building,
    unit: `${building}-${R5.int(3, 22)}${String(R5.int(1, 8)).padStart(2, '0')}`,
    annualRent,
    depositSar: Math.round(annualRent * (0.038 + R5.next() * 0.012)), // always ≤ 5%
    status: i < 20 ? 'registered' : i < 24 ? 'renewal_due' : 'pending',
    registeredDay: R5.pick(DAY_KEYS.slice(-75)),
  };
});

/** Renewal requests refused because they exceeded the Riyadh rent freeze. */
export const FREEZE_BLOCKED_RENEWALS = 3;

export interface DailyShortStay {
  day: string;
  /** Licensed nightly units in the programme. */
  units: number;
  occupied: number;
  /** Average daily rate, SAR. */
  adr: number;
  revenue: number;
  vat: number;
}

export const SHORT_STAY_DAILY: readonly DailyShortStay[] = DAY_KEYS.map((day, i) => {
  const units = 12;
  const wd = weekday(day);
  const weekendNight = wd === 4 || wd === 5;
  const ramp = 0.45 + (i / DAYS) * 0.3;
  const occupied = Math.min(units, Math.round(units * (ramp + (weekendNight ? 0.22 : 0)) + R5.int(-1, 1)));
  const adr = R5.round2((weekendNight ? 980 : 760) + R5.next() * 120);
  const revenue = R5.round2(occupied * adr);
  return { day, units, occupied, adr, revenue, vat: R5.round2(revenue * 0.15) };
});

// -------------------------------------------- venue trading hours (real)

export interface VenueHoursRow {
  id: string;
  name: string;
  /** Windows per weekday index (0=Sun); close ≤ open spills past midnight. */
  windows: readonly { days: readonly number[]; open: string; close: string }[];
  bookable: boolean;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

export const VENUE_HOURS: readonly VenueHoursRow[] = [
  { id: 'benoit', name: 'Benoit', bookable: true, windows: [{ days: EVERY_DAY, open: '12:00', close: '16:00' }, { days: EVERY_DAY, open: '19:00', close: '23:00' }] },
  { id: 'il-baretto', name: 'Il Baretto', bookable: true, windows: [{ days: [2, 3, 4, 5, 6, 0], open: '12:30', close: '24:00' }, { days: [1], open: '12:00', close: '24:00' }] },
  { id: 'zuma', name: 'Zuma', bookable: true, windows: [{ days: [0, 1, 2, 3], open: '12:00', close: '24:00' }, { days: [4, 5, 6], open: '12:00', close: '01:00' }] },
  { id: 'chotto-matte', name: 'Chotto Matte', bookable: true, windows: [{ days: EVERY_DAY, open: '12:00', close: '01:00' }] },
  { id: 'rowleys', name: "Rowley's Steak & Frites", bookable: true, windows: [{ days: [0, 1, 6], open: '12:00', close: '24:00' }, { days: [3, 4], open: '12:00', close: '02:00' }, { days: [2, 5], open: '12:00', close: '01:00' }] },
  { id: '12-cups', name: '12 Cups', bookable: true, windows: [{ days: [0, 1, 2, 3, 4, 5], open: '00:00', close: '24:00' }, { days: [6], open: '00:00', close: '23:30' }] },
  { id: 'apple-butter', name: 'Apple Butter Café', bookable: true, windows: [{ days: EVERY_DAY, open: '08:00', close: '22:30' }] },
  { id: 'atlas-cafe', name: 'Atlas Cafe', bookable: true, windows: [{ days: EVERY_DAY, open: '07:30', close: '23:30' }] },
  { id: 'kanto', name: 'Kanto', bookable: true, windows: [{ days: EVERY_DAY, open: '12:00', close: '24:00' }] },
  { id: 'pistrina', name: 'Pistrina Bakery', bookable: true, windows: [{ days: EVERY_DAY, open: '06:30', close: '23:00' }] },
];

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

// --------------------------------------------------------- estate super admin
// URWA-core operations: home-services orders, gate security, partner
// settlements, and the HR/WPS layer. Isolated PRNG so nothing above shifts.

const rand6 = mulberry32(20261224);
const R6 = {
  next: () => rand6(),
  int: (min: number, max: number) => min + Math.floor(rand6() * (max - min + 1)),
  pick: <T,>(items: readonly T[]): T => items[Math.floor(rand6() * items.length)],
  round2: (v: number) => Math.round(v * 100) / 100,
};

export interface DailyEstateOps {
  day: string;
  laundry: number;
  housekeeping: number;
  roomService: number;
  /** Orders that missed their SLA promise (instant credits were paid). */
  slaMissed: number;
  creditsPaid: number;
  gateAllowed: number;
  gateDenied: number;
}

export const ESTATE_OPS_DAILY: readonly DailyEstateOps[] = DAY_KEYS.map((day, i) => {
  const ramp = 0.55 + (i / DAYS) * 0.5;
  const laundry = Math.round(34 * ramp + R6.int(-4, 4));
  const housekeeping = Math.round(18 * ramp + R6.int(-3, 3));
  const roomService = Math.round(26 * ramp + R6.int(-4, 4));
  const total = laundry + housekeeping + roomService;
  const slaMissed = Math.max(0, Math.round(total * (0.045 - (i / DAYS) * 0.02) + R6.int(-1, 1)));
  return {
    day,
    laundry,
    housekeeping,
    roomService,
    slaMissed,
    creditsPaid: R6.round2(slaMissed * (7 + R6.next() * 6)),
    gateAllowed: Math.round(210 * ramp + R6.int(-15, 15)),
    gateDenied: R6.int(2, 9),
  };
});

export interface EstatePartnerRow {
  id: string;
  name: string;
  category: 'laundry' | 'housekeeping' | 'room_service';
  agreementNo: string;
  /** Commission rate the platform takes on this category. */
  commissionPct: number;
  grossSar: number;
  rating: number;
  status: 'live' | 'onboarding';
}

const PARTNER_NAMES: readonly [string, EstatePartnerRow['category']][] = [
  ['KAFD Laundry Co.', 'laundry'],
  ['Crystal Press', 'laundry'],
  ['Wadi Housekeeping', 'housekeeping'],
  ['Sparkle Facilities', 'housekeeping'],
  ['Majlis Room Service', 'room_service'],
  ['Dallah Trays', 'room_service'],
  ['Nawa Linen Care', 'laundry'],
  ['Tamam Home Care', 'housekeeping'],
];

export const ESTATE_PARTNERS: readonly EstatePartnerRow[] = PARTNER_NAMES.map(([name, category], i) => ({
  id: `ep-${i + 1}`,
  name,
  category,
  agreementNo: `PRT-2026-${String(100000 + i * 8317).slice(-6)}`,
  commissionPct: category === 'laundry' ? 15 : category === 'housekeeping' ? 12 : 18,
  grossSar: R6.int(18, 120) * 1000,
  rating: R6.round2(4.4 + R6.next() * 0.55),
  status: i < 6 ? 'live' : 'onboarding',
}));

// ----- HR / WPS (Super Admin people layer) -----

export interface Employee {
  id: string;
  name: string;
  dept: 'Captains' | 'Gate Security' | 'Housekeeping' | 'Concierge' | 'Admin';
  basicSar: number;
  housingSar: number;
  otherSar: number;
  /** Today's attendance state. */
  attendance: 'present' | 'remote' | 'leave' | 'absent';
}

const EMP_NAMES = [
  'Omar N.', 'Faisal A.', 'Yusuf K.', 'Hamad S.', 'Salem R.', 'Badr M.',
  'Khalid T.', 'Nasser J.', 'Rakan D.', 'Saad W.', 'Noura S.', 'Reem A.',
  'Lama F.', 'Dana Q.', 'Hessa B.', 'Joud E.', 'Aziz G.', 'Turki H.',
  'Mishal V.', 'Fahad Z.', 'Sara L.', 'Maha C.', 'Ghada P.', 'Amal Y.',
] as const;
const DEPTS: readonly Employee['dept'][] = ['Captains', 'Captains', 'Gate Security', 'Gate Security', 'Housekeeping', 'Housekeeping', 'Concierge', 'Admin'];

export const EMPLOYEES: readonly Employee[] = EMP_NAMES.map((name, i) => {
  const dept = DEPTS[i % DEPTS.length];
  const basic = R6.int(45, 110) * 100;
  const roll = R6.next();
  return {
    id: `emp-${String(i + 1).padStart(3, '0')}`,
    name,
    dept,
    basicSar: basic,
    housingSar: Math.round(basic * 0.25),
    otherSar: R6.int(3, 9) * 100,
    attendance: roll < 0.78 ? 'present' : roll < 0.88 ? 'remote' : roll < 0.95 ? 'leave' : 'absent',
  };
});

export interface WpsRun {
  id: string;
  month: string;
  /** WPS Salary Information File reference submitted to the bank. */
  sifRef: string;
  employees: number;
  totalSar: number;
  status: 'accepted' | 'submitted' | 'draft';
}

const wpsTotal = EMPLOYEES.reduce((s, e) => s + e.basicSar + e.housingSar + e.otherSar, 0);
export const WPS_RUNS: readonly WpsRun[] = [
  { id: 'wps-3', month: 'Aug 2026', sifRef: 'WPS-SIF-202608-4417', employees: EMPLOYEES.length, totalSar: wpsTotal, status: 'submitted' },
  { id: 'wps-2', month: 'Jul 2026', sifRef: 'WPS-SIF-202607-3902', employees: EMPLOYEES.length, totalSar: wpsTotal - 1800, status: 'accepted' },
  { id: 'wps-1', month: 'Jun 2026', sifRef: 'WPS-SIF-202606-3341', employees: EMPLOYEES.length - 2, totalSar: wpsTotal - 15400, status: 'accepted' },
];

export interface RecruitmentRole {
  role: string;
  dept: Employee['dept'];
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
}

export const RECRUITMENT: readonly RecruitmentRole[] = [
  { role: 'Service Captain', dept: 'Captains', applied: 142, screening: 58, interview: 21, offer: 8, hired: 5 },
  { role: 'Gate Officer', dept: 'Gate Security', applied: 96, screening: 40, interview: 14, offer: 6, hired: 4 },
  { role: 'Housekeeping Lead', dept: 'Housekeeping', applied: 63, screening: 24, interview: 9, offer: 3, hired: 2 },
  { role: 'Night Concierge', dept: 'Concierge', applied: 51, screening: 19, interview: 7, offer: 2, hired: 1 },
];

// --------------------------------------------------------- control panel (IAM)
// Platform governance: division admins, role catalog with least-privilege
// permissions, joiner/mover/leaver lifecycle, access reviews, and dual-control
// finance approvals. Isolated PRNG so nothing above shifts.

const rand7 = mulberry32(20270115);
const R7 = {
  next: () => rand7(),
  int: (min: number, max: number) => min + Math.floor(rand7() * (max - min + 1)),
  pick: <T,>(items: readonly T[]): T => items[Math.floor(rand7() * items.length)],
};

export type Division =
  | 'platform' | 'mobility' | 'property' | 'hospitality' | 'estate' | 'finance' | 'people' | 'security';

export type AdminRoleId =
  | 'super_admin' | 'division_admin' | 'ops_analyst' | 'finance_maker' | 'finance_checker'
  | 'hr_admin' | 'security_officer' | 'support_agent' | 'auditor';

export type PermissionId =
  | 'view_dashboards' | 'manage_users' | 'invite_admin' | 'suspend_admin' | 'approve_access'
  | 'manage_roles' | 'prepare_payout' | 'approve_payout' | 'issue_refund' | 'approve_refund'
  | 'manage_blacklist' | 'manage_catalog' | 'run_payroll' | 'export_data' | 'view_audit' | 'manage_cms';

export const PERMISSIONS: readonly { id: PermissionId; label: string }[] = [
  { id: 'view_dashboards', label: 'View dashboards' },
  { id: 'manage_users', label: 'Manage app users' },
  { id: 'invite_admin', label: 'Invite admins' },
  { id: 'suspend_admin', label: 'Suspend admins' },
  { id: 'approve_access', label: 'Approve access requests' },
  { id: 'manage_roles', label: 'Edit role catalog' },
  { id: 'prepare_payout', label: 'Prepare payouts' },
  { id: 'approve_payout', label: 'Approve payouts' },
  { id: 'issue_refund', label: 'Issue refunds' },
  { id: 'approve_refund', label: 'Approve refunds' },
  { id: 'manage_blacklist', label: 'Manage gate blacklist' },
  { id: 'manage_catalog', label: 'Manage partner catalogs' },
  { id: 'run_payroll', label: 'Run WPS payroll' },
  { id: 'export_data', label: 'Export data (PDPL)' },
  { id: 'view_audit', label: 'View audit log' },
  { id: 'manage_cms', label: 'Manage CMS content' },
];

export interface AdminRole {
  id: AdminRoleId;
  label: string;
  permissions: readonly PermissionId[];
  /** How many people may hold this role at once (least privilege). */
  maxHolders?: number;
}

export const ROLE_CATALOG: readonly AdminRole[] = [
  { id: 'super_admin', label: 'Super Admin', maxHolders: 3, permissions: PERMISSIONS.map((p) => p.id) },
  { id: 'division_admin', label: 'Division Admin', permissions: ['view_dashboards', 'manage_users', 'invite_admin', 'manage_catalog', 'export_data', 'view_audit', 'manage_cms'] },
  { id: 'ops_analyst', label: 'Ops Analyst', permissions: ['view_dashboards', 'export_data'] },
  { id: 'finance_maker', label: 'Finance Maker', permissions: ['view_dashboards', 'prepare_payout', 'issue_refund'] },
  { id: 'finance_checker', label: 'Finance Checker', permissions: ['view_dashboards', 'approve_payout', 'approve_refund', 'view_audit'] },
  { id: 'hr_admin', label: 'HR Admin', permissions: ['view_dashboards', 'run_payroll', 'manage_users', 'export_data'] },
  { id: 'security_officer', label: 'Security Officer', permissions: ['view_dashboards', 'manage_blacklist', 'view_audit'] },
  { id: 'support_agent', label: 'Support Agent', permissions: ['view_dashboards', 'manage_users'] },
  { id: 'auditor', label: 'Auditor', permissions: ['view_dashboards', 'view_audit', 'export_data'] },
];

/**
 * Segregation-of-duties: permission pairs no single person may hold.
 * Super admins are exempt only via break-glass, which is alarmed + audited.
 */
export const SOD_FORBIDDEN: readonly [PermissionId, PermissionId][] = [
  ['prepare_payout', 'approve_payout'],
  ['issue_refund', 'approve_refund'],
  ['run_payroll', 'approve_payout'],
  ['invite_admin', 'approve_access'],
];

export interface AdminUser {
  id: string;
  name: string;
  division: Division;
  role: AdminRoleId;
  mfa: boolean;
  nafathVerified: boolean;
  lastActiveDay: string;
  status: 'active' | 'suspended' | 'invited';
}

const ADMIN_SEED: readonly [string, Division, AdminRoleId, boolean][] = [
  ['Layla Al-Rashid', 'platform', 'super_admin', true],
  ['Abdullah Qahtani', 'platform', 'super_admin', true],
  ['Mona Al-Harbi', 'mobility', 'division_admin', true],
  ['Tariq Anazi', 'mobility', 'ops_analyst', true],
  ['Huda Al-Otaibi', 'property', 'division_admin', true],
  ['Sultan Ghamdi', 'property', 'ops_analyst', false],
  ['Rania Al-Saud', 'hospitality', 'division_admin', true],
  ['Majed Dossari', 'hospitality', 'support_agent', true],
  ['Nasser Al-Shehri', 'estate', 'division_admin', true],
  ['Waleed Harthi', 'estate', 'security_officer', true],
  ['Aisha Zahrani', 'finance', 'finance_checker', true],
  ['Fahad Al-Mutairi', 'finance', 'finance_maker', true],
  ['Salma Juhani', 'finance', 'finance_maker', true],
  ['Omar Bishi', 'people', 'hr_admin', true],
  ['Nora Al-Amri', 'people', 'hr_admin', false],
  ['Khalid Subaie', 'security', 'security_officer', true],
  ['Dana Al-Fadl', 'platform', 'auditor', true],
  ['Yara Qurashi', 'hospitality', 'ops_analyst', true],
];

export const ADMINS: readonly AdminUser[] = ADMIN_SEED.map(([name, division, role, mfa], i) => ({
  id: `adm-${String(i + 1).padStart(3, '0')}`,
  name,
  division,
  role,
  mfa,
  nafathVerified: i !== 5, // one pending Nafath verification
  lastActiveDay: DAY_KEYS[DAYS - 1 - (i === 14 ? 41 : i === 17 ? 33 : R7.int(0, 6))],
  status: i === 15 ? 'invited' : 'active',
}));

export interface AccessRequest {
  id: string;
  kind: 'joiner' | 'mover' | 'leaver';
  person: string;
  division: Division;
  /** Target role for joiners/movers; current role for leavers. */
  role: AdminRoleId;
  requestedBy: string;
  ageDays: number;
  note: string;
}

export const ACCESS_REQUESTS: readonly AccessRequest[] = [
  { id: 'req-01', kind: 'joiner', person: 'Ghada Al-Nasser', division: 'hospitality', role: 'support_agent', requestedBy: 'Rania Al-Saud', ageDays: 1, note: 'New venue-support hire, starts Sunday' },
  { id: 'req-02', kind: 'joiner', person: 'Bader Al-Qadi', division: 'finance', role: 'finance_maker', requestedBy: 'Aisha Zahrani', ageDays: 2, note: 'Settlement team expansion' },
  { id: 'req-03', kind: 'mover', person: 'Tariq Anazi', division: 'mobility', role: 'division_admin', requestedBy: 'Mona Al-Harbi', ageDays: 4, note: 'Promotion — backfill analyst seat first' },
  { id: 'req-04', kind: 'mover', person: 'Salma Juhani', division: 'finance', role: 'finance_checker', requestedBy: 'Aisha Zahrani', ageDays: 1, note: 'BLOCKED by SoD until maker rights are dropped' },
  { id: 'req-05', kind: 'leaver', person: 'Nora Al-Amri', division: 'people', role: 'hr_admin', requestedBy: 'Omar Bishi', ageDays: 3, note: 'Contract ended — run offboarding checklist' },
];

export interface OffboardingStep {
  step: string;
  done: boolean;
}

export interface OffboardingCase {
  person: string;
  division: Division;
  startedDay: string;
  steps: readonly OffboardingStep[];
}

export const OFFBOARDING_CASES: readonly OffboardingCase[] = [
  {
    person: 'Nora Al-Amri',
    division: 'people',
    startedDay: DAY_KEYS[DAYS - 3],
    steps: [
      { step: 'Revoke SSO + all sessions', done: true },
      { step: 'Remove role assignments', done: true },
      { step: 'Reassign pending approvals', done: true },
      { step: 'Disable payroll access', done: false },
      { step: 'Transfer owned exports', done: false },
      { step: 'Archive mailbox (PDPL 90d)', done: false },
    ],
  },
  {
    person: 'Ibrahim Talal',
    division: 'mobility',
    startedDay: DAY_KEYS[DAYS - 9],
    steps: [
      { step: 'Revoke SSO + all sessions', done: true },
      { step: 'Remove role assignments', done: true },
      { step: 'Reassign pending approvals', done: true },
      { step: 'Disable payroll access', done: true },
      { step: 'Transfer owned exports', done: true },
      { step: 'Archive mailbox (PDPL 90d)', done: true },
    ],
  },
];

export interface AccessReviewRow {
  division: Division;
  total: number;
  reviewed: number;
  revoked: number;
}

/** Q3-2026 quarterly recertification campaign. */
export const ACCESS_REVIEW: readonly AccessReviewRow[] = [
  { division: 'platform', total: 4, reviewed: 4, revoked: 0 },
  { division: 'mobility', total: 3, reviewed: 3, revoked: 1 },
  { division: 'property', total: 2, reviewed: 2, revoked: 0 },
  { division: 'hospitality', total: 3, reviewed: 2, revoked: 0 },
  { division: 'estate', total: 2, reviewed: 1, revoked: 0 },
  { division: 'finance', total: 3, reviewed: 3, revoked: 0 },
  { division: 'people', total: 2, reviewed: 1, revoked: 1 },
  { division: 'security', total: 1, reviewed: 1, revoked: 0 },
];

export interface FinanceApproval {
  id: string;
  type: 'partner_payout' | 'resident_refund' | 'invoice_adjustment';
  ref: string;
  division: Division;
  amountSar: number;
  maker: string;
  checker: string | null;
  status: 'pending' | 'approved' | 'rejected';
  ageHours: number;
}

export const FINANCE_QUEUE: readonly FinanceApproval[] = [
  { id: 'fin-01', type: 'partner_payout', ref: 'PAY-2026-0821', division: 'estate', amountSar: 48230, maker: 'Fahad Al-Mutairi', checker: null, status: 'pending', ageHours: 3 },
  { id: 'fin-02', type: 'partner_payout', ref: 'PAY-2026-0822', division: 'hospitality', amountSar: 112400, maker: 'Salma Juhani', checker: null, status: 'pending', ageHours: 6 },
  { id: 'fin-03', type: 'resident_refund', ref: 'RFD-2026-1187', division: 'estate', amountSar: 640, maker: 'Fahad Al-Mutairi', checker: null, status: 'pending', ageHours: 1 },
  { id: 'fin-04', type: 'invoice_adjustment', ref: 'ADJ-2026-0233', division: 'property', amountSar: 8750, maker: 'Salma Juhani', checker: null, status: 'pending', ageHours: 22 },
  { id: 'fin-05', type: 'partner_payout', ref: 'PAY-2026-0819', division: 'estate', amountSar: 51000, maker: 'Fahad Al-Mutairi', checker: 'Aisha Zahrani', status: 'approved', ageHours: 28 },
  { id: 'fin-06', type: 'resident_refund', ref: 'RFD-2026-1181', division: 'mobility', amountSar: 95, maker: 'Salma Juhani', checker: 'Aisha Zahrani', status: 'approved', ageHours: 30 },
  { id: 'fin-07', type: 'invoice_adjustment', ref: 'ADJ-2026-0229', division: 'hospitality', amountSar: 15600, maker: 'Fahad Al-Mutairi', checker: 'Aisha Zahrani', status: 'rejected', ageHours: 50 },
];

/** Single-approval ceilings by role; anything above needs a second checker. */
export const APPROVAL_LIMITS: readonly { role: AdminRoleId; limitSar: number }[] = [
  { role: 'finance_checker', limitSar: 100000 },
  { role: 'division_admin', limitSar: 25000 },
  { role: 'super_admin', limitSar: 250000 },
];
