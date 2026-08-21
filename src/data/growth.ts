// Console v2 — growth, loyalty, bookings and events datasets + aggregations.
// Same deterministic-seed approach as seed.ts; replaced by services/* later.

import { DAYS, DAY_KEYS, R } from './seed';

// ------------------------------------------------------------- growth (DAU)

export interface DailyActive {
  day: string;
  dau: number;
  wau: number;
  newUsers: number;
}

export const ACTIVE_DAILY: readonly DailyActive[] = DAY_KEYS.map((day, i) => {
  const g = 0.5 + (i / DAYS) * 0.7;
  const dau = Math.round(420 * g + R.int(-25, 30));
  return {
    day,
    dau,
    wau: Math.round(dau * (2.6 + R.next() * 0.4)),
    newUsers: Math.round(26 * g + R.int(-6, 10)),
  };
});

/** Weekly retention cohorts: % of a signup cohort active N weeks later. */
export interface Cohort {
  week: string;
  size: number;
  /** retention[0] = week 0 (100), up to 8 weeks. */
  retention: number[];
}

export const COHORTS: readonly Cohort[] = Array.from({ length: 8 }, (_, index) => {
  const week = DAY_KEYS[index * 7];
  const size = R.int(140, 260);
  const weeksObserved = 8 - index;
  let previous = 100;
  const retention = Array.from({ length: weeksObserved }, (_, weekOut) => {
    if (weekOut === 0) return 100;
    // Retention improves for newer cohorts as the app gains pillars.
    const floor = 32 + index * 2.2;
    previous = Math.max(floor, previous - (weekOut === 1 ? R.int(26, 34) : R.int(2, 7)) + index * 0.6);
    return Math.round(previous);
  });
  return { week, size, retention };
});

export function stickiness(days: readonly DailyActive[]): number {
  const avgDau = days.reduce((sum, d) => sum + d.dau, 0) / days.length;
  const avgWau = days.reduce((sum, d) => sum + d.wau, 0) / days.length;
  return Math.round((avgDau / avgWau) * 1000) / 10;
}

// ----------------------------------------------------------------- loyalty

export interface DailyLoyalty {
  day: string;
  pointsIssued: number;
  pointsRedeemed: number;
  members: number;
}

export const LOYALTY_DAILY: readonly DailyLoyalty[] = DAY_KEYS.map((day, i) => {
  const g = 0.4 + (i / DAYS) * 0.9;
  const issued = Math.round(21000 * g + R.int(-1800, 2200));
  return {
    day,
    pointsIssued: issued,
    pointsRedeemed: Math.round(issued * (0.32 + R.next() * 0.18)),
    members: Math.round(2600 * (0.5 + (i / DAYS) * 0.6)),
  };
});

export const TIER_MIX = [
  { tier: 'silver', members: 2412, color: '#c5cfe4' },
  { tier: 'gold', members: 604, color: '#e8b463' },
  { tier: 'platinum', members: 118, color: '#b9c8ea' },
] as const;

export interface LoyaltyKpis {
  members: number;
  pointsIssued: number;
  pointsRedeemed: number;
  redemptionRate: number;
  /** Outstanding points × SAR value (500 pts = SAR 5). */
  liabilitySar: number;
}

export function loyaltyKpis(window: readonly DailyLoyalty[]): LoyaltyKpis {
  const pointsIssued = window.reduce((sum, d) => sum + d.pointsIssued, 0);
  const pointsRedeemed = window.reduce((sum, d) => sum + d.pointsRedeemed, 0);
  const outstanding = LOYALTY_DAILY.reduce((sum, d) => sum + d.pointsIssued - d.pointsRedeemed, 0);
  return {
    members: window[window.length - 1]?.members ?? 0,
    pointsIssued,
    pointsRedeemed,
    redemptionRate: pointsIssued === 0 ? 0 : Math.round((pointsRedeemed / pointsIssued) * 1000) / 10,
    liabilitySar: Math.round((outstanding / 500) * 5),
  };
}

export interface OfferPerformance {
  id: string;
  title: string;
  pillar: string;
  claims: number;
  redemptions: number;
}

export const OFFER_PERFORMANCE: readonly OfferPerformance[] = [
  { id: 'of-ride10', title: '10% off metered rides', pillar: 'rafiq', claims: 812, redemptions: 511 },
  { id: 'of-go10', title: '10% off Go orders', pillar: 'go', claims: 736, redemptions: 486 },
  { id: 'of-freedel', title: 'Free delivery week (Gold)', pillar: 'go', claims: 342, redemptions: 301 },
  { id: 'of-ride5', title: 'SAR 5 off any ride', pillar: 'rafiq', claims: 654, redemptions: 388 },
  { id: 'of-dine-dessert', title: 'Dessert on the house', pillar: 'dine', claims: 289, redemptions: 174 },
  { id: 'of-padel-happy', title: 'Padel happy hour −30%', pillar: 'workplay', claims: 208, redemptions: 156 },
];

// ------------------------------------------------------- bookings & events

export const BOOKING_RESOURCES = [
  { id: 'room-boardroom', name: 'Boardroom One', kind: 'room', price: 400 },
  { id: 'room-summit', name: 'Summit Room', kind: 'room', price: 250 },
  { id: 'room-huddle', name: 'Huddle Pod', kind: 'room', price: 150 },
  { id: 'court-padel-1', name: 'Padel Court 1', kind: 'court', price: 120 },
  { id: 'court-padel-2', name: 'Padel Court 2', kind: 'court', price: 120 },
] as const;

export const BOOKING_HOURS = [8, 10, 12, 14, 16, 18, 20] as const;

/** Utilization % per resource per 2-hour band (heatmap). */
export const BOOKING_UTILIZATION: readonly { resourceId: string; hour: number; pct: number }[] =
  BOOKING_RESOURCES.flatMap((resource) =>
    BOOKING_HOURS.map((hour) => ({
      resourceId: resource.id,
      hour,
      pct:
        resource.kind === 'room'
          ? hour >= 10 && hour <= 14
            ? R.int(62, 96)
            : hour >= 8 && hour <= 16
              ? R.int(35, 70)
              : R.int(5, 25)
          : hour >= 18
            ? R.int(70, 98)
            : hour <= 8
              ? R.int(40, 75)
              : R.int(15, 45),
    })),
  );

export interface DailyBookings {
  day: string;
  bookings: number;
  revenue: number;
}

export const BOOKINGS_DAILY: readonly DailyBookings[] = DAY_KEYS.map((day, i) => {
  const g = 0.45 + (i / DAYS) * 0.8;
  const bookings = Math.round(26 * g + R.int(-4, 6));
  return { day, bookings, revenue: Math.round(bookings * (170 + R.next() * 60)) };
});

export interface EventPerformance {
  id: string;
  name: string;
  date: string;
  capacity: number;
  rsvps: number;
  checkins: number | null;
}

export const EVENT_PERFORMANCE: readonly EventPerformance[] = [
  { id: 'ev-padel-cup', name: 'KAFD Padel Cup — Qualifiers', date: '2026-08-23', capacity: 32, rsvps: 27, checkins: null },
  { id: 'ev-sunrise-run', name: 'Skywalk Sunrise Run 5K', date: '2026-08-25', capacity: 120, rsvps: 89, checkins: null },
  { id: 'ev-sat-market', name: 'KAFD Saturday Market', date: '2026-08-27', capacity: 400, rsvps: 214, checkins: null },
  { id: 'ev-cfo-forum', name: 'District CFO Forum', date: '2026-08-30', capacity: 180, rsvps: 171, checkins: null },
  { id: 'ev-noor-open', name: 'Noor Riyadh Preview Night', date: '2026-08-14', capacity: 350, rsvps: 341, checkins: 296 },
  { id: 'ev-wellness', name: 'Rooftop Wellness Gathering', date: '2026-08-09', capacity: 60, rsvps: 60, checkins: 51 },
];

export function eventFillPct(event: EventPerformance): number {
  return Math.round((event.rsvps / event.capacity) * 100);
}

export function eventShowRate(event: EventPerformance): number | null {
  return event.checkins == null ? null : Math.round((event.checkins / event.rsvps) * 100);
}
