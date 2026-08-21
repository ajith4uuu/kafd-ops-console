import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar, shortDay } from '../components/ui';
import { lastN, sumBy, type Range } from '../data/analytics';
import {
  BOOKINGS_DAILY,
  BOOKING_HOURS,
  BOOKING_RESOURCES,
  BOOKING_UTILIZATION,
  EVENT_PERFORMANCE,
  eventFillPct,
  eventShowRate,
} from '../data/growth';

function utilColor(pct: number): string {
  if (pct >= 85) return `rgba(255, 141, 161, ${0.35 + (pct / 100) * 0.6})`;
  return `rgba(197, 207, 228, ${0.15 + (pct / 100) * 0.8})`;
}

export function BookingsPage({ range }: { range: Range }) {
  const window = lastN(BOOKINGS_DAILY, range);
  const revenue = sumBy(window, (d) => d.revenue);
  const bookings = sumBy(window, (d) => d.bookings);
  const revSeries = window.map((d) => ({ day: shortDay(d.day), revenue: d.revenue }));
  const roomUtil = BOOKING_UTILIZATION.filter((u) => BOOKING_RESOURCES.find((r) => r.id === u.resourceId)?.kind === 'room');
  const avgRoomUtil = Math.round(roomUtil.reduce((a, b) => a + b.pct, 0) / roomUtil.length);
  const courtUtil = BOOKING_UTILIZATION.filter((u) => BOOKING_RESOURCES.find((r) => r.id === u.resourceId)?.kind === 'court');
  const avgCourtUtil = Math.round(courtUtil.reduce((a, b) => a + b.pct, 0) / courtUtil.length);
  const upcoming = EVENT_PERFORMANCE.filter((e) => e.checkins == null);
  const past = EVENT_PERFORMANCE.filter((e) => e.checkins != null);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Bookings" value={num(bookings)} />
        <Kpi label="Booking revenue" value={sar(revenue)} />
        <Kpi label="Avg room utilization" value={`${avgRoomUtil}%`} />
        <Kpi label="Avg court utilization" value={`${avgCourtUtil}%`} />
        <Kpi label="Upcoming events" value={String(upcoming.length)} />
        <Kpi label="Avg event fill" value={`${Math.round(EVENT_PERFORMANCE.reduce((a, e) => a + eventFillPct(e), 0) / EVENT_PERFORMANCE.length)}%`} />
      </div>

      <div className="grid cols-2">
        <Card title="Utilization heatmap — resource × 2-hour band" foot="Red = above 85%: candidates for dynamic pricing or added capacity">
          <div className="heat" style={{ gridTemplateColumns: `120px repeat(${BOOKING_HOURS.length}, 1fr)` }}>
            <span className="hlabel" />
            {BOOKING_HOURS.map((hour) => (
              <span key={hour} className="hlabel" style={{ justifyContent: 'center' }}>
                {hour}:00
              </span>
            ))}
            {BOOKING_RESOURCES.map((resource) => (
              <UtilRow key={resource.id} resourceId={resource.id} name={resource.name} />
            ))}
          </div>
        </Card>

        <Card title="Booking revenue (SAR/day)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revSeries}>
              <defs>
                <linearGradient id="bkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={46} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke={CHART.green} fill="url(#bkFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Upcoming events — RSVP fill">
          {upcoming.map((event) => {
            const fill = eventFillPct(event);
            return (
              <div key={event.id} style={{ marginBottom: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                  <span>
                    {event.name} <span style={{ color: 'var(--muted)' }}>· {event.date.slice(5)}</span>
                  </span>
                  <span>
                    {num(event.rsvps)}/{num(event.capacity)}{' '}
                    <Badge tone={fill >= 90 ? 'amber' : 'green'}>{fill}%</Badge>
                  </span>
                </div>
                <div className="progress">
                  <div style={{ width: `${fill}%`, background: fill >= 90 ? 'var(--amber)' : 'var(--green)' }} />
                </div>
              </div>
            );
          })}
        </Card>

        <Card title="Past events — show rate" foot="Show rate = check-ins ÷ RSVPs; door QR scans feed this">
          <DataTable
            rowKey={(e) => e.id}
            columns={[
              { key: 'name', label: 'Event', render: (e) => e.name },
              { key: 'date', label: 'Date', render: (e) => e.date.slice(5) },
              { key: 'rsvps', label: 'RSVPs', render: (e) => num(e.rsvps) },
              { key: 'checkins', label: 'Check-ins', render: (e) => num(e.checkins ?? 0) },
              {
                key: 'show',
                label: 'Show rate',
                render: (e) => {
                  const rate = eventShowRate(e)!;
                  return <Badge tone={rate >= 85 ? 'green' : 'amber'}>{rate}%</Badge>;
                },
              },
            ]}
            rows={past}
          />
        </Card>
      </div>
    </>
  );
}

function UtilRow({ resourceId, name }: { resourceId: string; name: string }) {
  return (
    <>
      <span className="hlabel">{name}</span>
      {BOOKING_HOURS.map((hour) => {
        const cell = BOOKING_UTILIZATION.find((u) => u.resourceId === resourceId && u.hour === hour);
        const pct = cell?.pct ?? 0;
        return (
          <span key={hour} className="hcell" style={{ background: utilColor(pct), color: pct > 55 ? '#0a1424' : 'var(--text-2)' }}>
            {pct}
          </span>
        );
      })}
    </>
  );
}
