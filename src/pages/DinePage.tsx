import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART, Card, DataTable, Kpi, num, shortDay } from '../components/ui';
import { dineKpis, lastN, trendPct, type Range } from '../data/analytics';
import { DINE_DAILY, DINE_HOURS, DINE_PACING, VENUES, type Venue } from '../data/seed';

function heatColor(value: number, max: number): string {
  const ratio = Math.min(1, value / Math.max(1, max));
  if (ratio === 0) return 'rgba(255,255,255,0.05)';
  const alpha = 0.25 + ratio * 0.75;
  return ratio > 0.85 ? `rgba(255, 141, 161, ${alpha})` : `rgba(197, 207, 228, ${alpha})`;
}

export function DinePage({ range }: { range: Range }) {
  const kpis = dineKpis(range);
  const window = lastN(DINE_DAILY, range);
  const covers = window.map((d) => ({ day: shortDay(d.day), covers: d.covers, reservations: d.reservations }));
  const noShow = window.map((d) => ({
    day: shortDay(d.day),
    rate: d.reservations === 0 ? 0 : Math.round((d.noShows / d.reservations) * 1000) / 10,
  }));

  const maxSeatings = Math.max(...DINE_PACING.map((p) => p.seatings));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Covers" value={num(kpis.covers)} trend={trendPct(DINE_DAILY, range, (d) => d.covers)} />
        <Kpi label="Reservations" value={num(kpis.reservations)} trend={trendPct(DINE_DAILY, range, (d) => d.reservations)} />
        <Kpi label="No-show rate" value={`${kpis.noShowRate}%`} trend={trendPct(DINE_DAILY, range, (d) => d.noShows)} invertTrend />
        <Kpi label="Waitlist claim rate" value={`${kpis.waitlistClaimRate}%`} />
        <Kpi label="Deposit-guarded" value={`${kpis.depositShare}%`} />
        <Kpi label="Bookable venues" value={String(VENUES.filter((v) => v.bookable).length)} />
      </div>

      <div className="grid cols-2">
        <Card title="Covers & reservations per day">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={covers}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Bar dataKey="covers" fill={CHART.amber} radius={[3, 3, 0, 0]} />
              <Bar dataKey="reservations" fill={CHART.peri} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="No-show rate (%)" foot="Deposits auto-suggested for venues trending above the 8% target">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={noShow}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} domain={[0, 14]} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke={CHART.red} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card
        title="Pacing heatmap — seatings started per service hour"
        foot="Red cells exceed table pacing caps → smart-pacing suggestions sent to merchants"
      >
        <div className="heat" style={{ gridTemplateColumns: `130px repeat(${DINE_HOURS.length}, 1fr)` }}>
          <span className="hlabel" />
          {DINE_HOURS.map((hour) => (
            <span key={hour} className="hlabel" style={{ justifyContent: 'center' }}>
              {hour}:00
            </span>
          ))}
          {VENUES.map((venue) => (
            <HeatRow key={venue.id} venue={venue} max={maxSeatings} />
          ))}
        </div>
      </Card>

      <Card title="Venue league table">
        <DataTable<Venue>
          rowKey={(v) => v.id}
          columns={[
            { key: 'name', label: 'Venue', render: (v) => v.name },
            { key: 'cuisine', label: 'Cuisine', render: (v) => v.cuisine },
            { key: 'tables', label: 'Tables', render: (v) => String(v.tables) },
            {
              key: 'peak',
              label: 'Peak-hour seatings',
              render: (v) =>
                String(
                  Math.max(
                    ...DINE_PACING.filter((p) => p.venueId === v.id).map((p) => p.seatings),
                  ),
                ),
            },
            {
              key: 'util',
              label: 'Peak utilization',
              render: (v) => {
                const peak = Math.max(...DINE_PACING.filter((p) => p.venueId === v.id).map((p) => p.seatings));
                return `${Math.round((peak / v.tables) * 100)}%`;
              },
            },
          ]}
          rows={VENUES}
        />
      </Card>
    </>
  );
}

function HeatRow({ venue, max }: { venue: Venue; max: number }) {
  return (
    <>
      <span className="hlabel">{venue.name}</span>
      {DINE_HOURS.map((hour) => {
        const cell = DINE_PACING.find((p) => p.venueId === venue.id && p.hour === hour);
        const seatings = cell?.seatings ?? 0;
        return (
          <span key={hour} className="hcell" style={{ background: heatColor(seatings, max) }}>
            {seatings}
          </span>
        );
      })}
    </>
  );
}
