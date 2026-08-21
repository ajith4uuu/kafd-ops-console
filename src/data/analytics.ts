// Aggregations over the operational dataset. Pure functions — unit-tested in
// scripts/analytics.test.ts and reused by every dashboard page.

import {
  AI_DAILY,
  AUDIT_LOG,
  BUILDINGS,
  DAYS,
  DINE_DAILY,
  DRIVERS,
  INCIDENTS,
  ORDERS_DAILY,
  RENT_INVOICES,
  RIDES_DAILY,
  WORK_ORDERS,
  type AuditEntry,
  type Invoice,
  type WoPriority,
  type WorkOrder,
} from './seed';

export type Range = 7 | 30 | 90;

export function lastN<T>(series: readonly T[], n: Range): T[] {
  return series.slice(Math.max(0, series.length - n));
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return Math.round(items.reduce((sum, item) => sum + pick(item), 0) * 100) / 100;
}

export function avgBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.length === 0 ? 0 : Math.round((sumBy(items, pick) / items.length) * 100) / 100;
}

/** % change of the last `n` days vs the `n` days before them. */
export function trendPct<T>(series: readonly T[], n: Range, pick: (item: T) => number): number {
  const current = sumBy(lastN(series, n), pick);
  const previous = sumBy(series.slice(Math.max(0, series.length - n * 2), series.length - n), pick);
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ------------------------------------------------------------------ rafiq

export function rafiqKpis(n: Range) {
  const window = lastN(RIDES_DAILY, n);
  const rides = sumBy(window, (d) => d.total);
  const pool = sumBy(window, (d) => d.byClass.pool);
  const matched = sumBy(window, (d) => d.poolMatched);
  return {
    rides,
    gmv: sumBy(window, (d) => d.gmv),
    poolMatchRate: pool === 0 ? 0 : Math.round((matched / pool) * 1000) / 10,
    co2Kg: sumBy(window, (d) => d.co2Kg),
    etaP50: avgBy(window, (d) => d.pickupEtaP50),
    etaP95: avgBy(window, (d) => d.pickupEtaP95),
    sos: sumBy(window, (d) => d.sosCount),
    cancellationRate: rides === 0 ? 0 : Math.round((sumBy(window, (d) => d.cancellations) / rides) * 1000) / 10,
  };
}

/** CO₂ program: cumulative kg saved plus derived equivalences. */
export function co2Program(n: Range) {
  const window = lastN(RIDES_DAILY, n);
  let running = 0;
  const cumulative = window.map((d) => {
    running = Math.round((running + d.co2Kg) * 100) / 100;
    return { day: d.day, kg: d.co2Kg, cumulativeKg: running };
  });
  const totalKg = running;
  return {
    cumulative,
    totalKg,
    treesEquivalent: Math.round(totalKg / 21), // ~21 kg CO₂ absorbed per tree/yr
    carKmEquivalent: Math.round(totalKg / 0.12),
    perPoolRideKg: (() => {
      const poolRides = sumBy(window, (d) => d.byClass.pool);
      return poolRides === 0 ? 0 : Math.round((totalKg / poolRides) * 100) / 100;
    })(),
  };
}

export function co2Leaderboard(): { name: string; kg: number }[] {
  // Deterministic split of the 90-day total across top riders.
  const total = co2Program(90).totalKg;
  const shares = [0.061, 0.052, 0.047, 0.041, 0.038, 0.033, 0.03, 0.027];
  const names = ['S. Alotaibi', 'R. Alghamdi', 'M. Chen', 'A. Alrashid', 'L. Fernandez', 'H. Almutairi', 'D. Okafor', 'N. Alsaud'];
  return names.map((name, i) => ({ name, kg: Math.round(total * shares[i] * 10) / 10 }));
}

export function driversAtRisk(): typeof DRIVERS {
  return DRIVERS.filter((d) => d.status !== 'active' || d.acceptance < 85 || d.cancellation >= 5);
}

// -------------------------------------------------------------------- dine

export function dineKpis(n: Range) {
  const window = lastN(DINE_DAILY, n);
  const reservations = sumBy(window, (d) => d.reservations);
  const noShows = sumBy(window, (d) => d.noShows);
  const joins = sumBy(window, (d) => d.waitlistJoins);
  return {
    covers: sumBy(window, (d) => d.covers),
    reservations,
    noShowRate: reservations === 0 ? 0 : Math.round((noShows / reservations) * 1000) / 10,
    waitlistClaimRate: joins === 0 ? 0 : Math.round((sumBy(window, (d) => d.waitlistClaims) / joins) * 1000) / 10,
    depositShare: reservations === 0 ? 0 : Math.round((sumBy(window, (d) => d.deposits) / reservations) * 1000) / 10,
  };
}

// ---------------------------------------------------------------------- go

export function goKpis(n: Range) {
  const window = lastN(ORDERS_DAILY, n);
  const orders = sumBy(window, (d) => d.orders);
  return {
    orders,
    gmv: sumBy(window, (d) => d.gmv),
    deskShare: Math.round(avgBy(window, (d) => d.deskShare) * 1000) / 10,
    medianDelivery: avgBy(window, (d) => d.medianDeliveryMin),
    p90Delivery: avgBy(window, (d) => d.p90DeliveryMin),
    issueRate: orders === 0 ? 0 : Math.round((sumBy(window, (d) => d.issues) / orders) * 1000) / 10,
    courierUtilization: Math.round(avgBy(window, (d) => d.courierUtilization) * 1000) / 10,
  };
}

// ---------------------------------------------------------------------- ai

export function aiKpis(n: Range) {
  const window = lastN(AI_DAILY, n);
  const toolCalls = sumBy(window, (d) => d.toolCalls);
  const transactions = sumBy(window, (d) => d.transactionsInitiated);
  return {
    sessions: sumBy(window, (d) => d.sessions),
    toolAccuracy: toolCalls === 0 ? 0 : Math.round((sumBy(window, (d) => d.toolSuccess) / toolCalls) * 1000) / 10,
    arShare: Math.round(avgBy(window, (d) => d.arShare) * 1000) / 10,
    transactions,
    costPerTransaction:
      transactions === 0 ? 0 : Math.round((sumBy(window, (d) => d.costSar) / transactions) * 100) / 100,
  };
}

// ------------------------------------------------------------------ living

export function occupancy() {
  const units = sumBy(BUILDINGS, (b) => b.units);
  const leased = sumBy(BUILDINGS, (b) => b.leased);
  return {
    units,
    leased,
    reserved: sumBy(BUILDINGS, (b) => b.reserved),
    ratePct: Math.round((leased / units) * 1000) / 10,
    walkthroughCoverage: Math.round(avgBy(BUILDINGS, (b) => b.walkthroughCoverage) * 10) / 10,
  };
}

export function woSlaByPriority(): { priority: WoPriority; total: number; withinSla: number; compliancePct: number }[] {
  return (['P1', 'P2', 'P3'] as const).map((priority) => {
    const orders = WORK_ORDERS.filter((wo) => wo.priority === priority);
    const withinSla = orders.filter((wo) => wo.responseHours <= wo.slaHours).length;
    return {
      priority,
      total: orders.length,
      withinSla,
      compliancePct: orders.length === 0 ? 100 : Math.round((withinSla / orders.length) * 1000) / 10,
    };
  });
}

export function woByStatus(): Record<WorkOrder['status'], number> {
  const counts: Record<WorkOrder['status'], number> = { open: 0, scheduled: 0, in_progress: 0, resolved: 0 };
  for (const wo of WORK_ORDERS) counts[wo.status] += 1;
  return counts;
}

export function arrearsAging(): { bucket: string; count: number; amount: number }[] {
  const overdue = RENT_INVOICES.filter((inv) => inv.status === 'overdue');
  const buckets: [string, (inv: Invoice) => boolean][] = [
    ['1–15d', (inv) => inv.agingDays <= 15],
    ['16–30d', (inv) => inv.agingDays > 15 && inv.agingDays <= 30],
    ['31–60d', (inv) => inv.agingDays > 30 && inv.agingDays <= 60],
    ['>60d', (inv) => inv.agingDays > 60],
  ];
  return buckets.map(([bucket, match]) => {
    const rows = overdue.filter(match);
    return { bucket, count: rows.length, amount: sumBy(rows, (inv) => inv.amount) };
  });
}

export function rentCollection() {
  const total = sumBy(RENT_INVOICES, (inv) => inv.amount);
  const paid = sumBy(RENT_INVOICES.filter((inv) => inv.status === 'paid'), (inv) => inv.amount);
  return { total, paid, collectedPct: Math.round((paid / total) * 1000) / 10 };
}

// --------------------------------------------------------------- incidents

export function openIncidents() {
  return INCIDENTS.filter((incident) => incident.status !== 'resolved');
}

// ------------------------------------------------------------------- audit

export interface AuditFilters {
  pillar?: AuditEntry['pillar'];
  role?: AuditEntry['role'];
  query?: string;
}

export function filterAudit(entries: readonly AuditEntry[], filters: AuditFilters): AuditEntry[] {
  const q = filters.query?.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (filters.pillar ? entry.pillar === filters.pillar : true) &&
      (filters.role ? entry.role === filters.role : true) &&
      (q
        ? entry.action.toLowerCase().includes(q) ||
          entry.entity.toLowerCase().includes(q) ||
          entry.actor.toLowerCase().includes(q)
        : true),
  );
}

export function auditToCsv(entries: readonly AuditEntry[]): string {
  const header = 'id,day,time,actor,role,pillar,action,entity,channel';
  const rows = entries.map((e) =>
    [e.id, e.day, e.time, e.actor, e.role, e.pillar, e.action, `"${e.entity}"`, e.channel].join(','),
  );
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------- overview

export function overviewKpis(n: Range) {
  const rafiq = rafiqKpis(n);
  const dine = dineKpis(n);
  const go = goKpis(n);
  const ai = aiKpis(n);
  return {
    gmv: Math.round((rafiq.gmv + go.gmv) * 100) / 100,
    rides: rafiq.rides,
    orders: go.orders,
    covers: dine.covers,
    co2Kg: rafiq.co2Kg,
    occupancyPct: occupancy().ratePct,
    aiTransactions: ai.transactions,
    openIncidents: openIncidents().length,
  };
}

export const AUDIT = AUDIT_LOG;
export { DAYS };
