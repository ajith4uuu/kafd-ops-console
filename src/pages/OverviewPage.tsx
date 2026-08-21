import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, Kpi, num, sar, shortDay } from '../components/ui';
import {
  aiKpis,
  dineKpis,
  goKpis,
  lastN,
  occupancy,
  openIncidents,
  overviewKpis,
  rafiqKpis,
  trendPct,
  type Range,
} from '../data/analytics';
import { DINE_DAILY, LIVE_FEED, ORDERS_DAILY, RIDES_DAILY } from '../data/seed';

export function OverviewPage({ range }: { range: Range }) {
  const kpis = overviewKpis(range);
  const rafiq = rafiqKpis(range);
  const dine = dineKpis(range);
  const go = goKpis(range);
  const ai = aiKpis(range);

  const volume = lastN(RIDES_DAILY, range).map((d, i) => ({
    day: shortDay(d.day),
    rides: d.total,
    orders: lastN(ORDERS_DAILY, range)[i].orders,
    covers: lastN(DINE_DAILY, range)[i].covers,
  }));

  const gmv = lastN(RIDES_DAILY, range).map((d, i) => ({
    day: shortDay(d.day),
    gmv: Math.round(d.gmv + lastN(ORDERS_DAILY, range)[i].gmv),
  }));

  const incidents = openIncidents();

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Cross-pillar GMV" value={sar(kpis.gmv)} trend={trendPct(RIDES_DAILY, range, (d) => d.gmv)} />
        <Kpi label="Rides" value={num(kpis.rides)} trend={trendPct(RIDES_DAILY, range, (d) => d.total)} />
        <Kpi label="Go orders" value={num(kpis.orders)} trend={trendPct(ORDERS_DAILY, range, (d) => d.orders)} />
        <Kpi label="Dine covers" value={num(kpis.covers)} trend={trendPct(DINE_DAILY, range, (d) => d.covers)} />
        <Kpi label="CO₂ saved (Pool)" value={`${num(Math.round(kpis.co2Kg))} kg`} trend={trendPct(RIDES_DAILY, range, (d) => d.co2Kg)} />
        <Kpi label="Residential occupancy" value={`${kpis.occupancyPct}%`} />
        <Kpi label="AI-initiated transactions" value={num(kpis.aiTransactions)} />
        <Kpi label="Open incidents" value={String(kpis.openIncidents)} />
      </div>

      <div className="grid cols-2">
        <Card title="Daily volume — rides · orders · covers">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={volume}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Line type="monotone" dataKey="rides" stroke={CHART.green} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="orders" stroke={CHART.peri} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="covers" stroke={CHART.amber} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="GMV (Rafiq + Go)">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={gmv}>
              <defs>
                <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.peri} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.peri} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={44} />
              <Tooltip />
              <Area type="monotone" dataKey="gmv" stroke={CHART.peri} fill="url(#gmvFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-3">
        <Card title="Live activity">
          <div className="feed">
            {LIVE_FEED.map((event, i) => (
              <div key={i} className="feed-row">
                <span className="feed-time">{event.time}</span>
                <span className={`pillar-chip pillar-${event.pillar}`}>{event.pillar}</span>
                <span>{event.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Incident board" foot="SOS routes to KAFD Security with one-tap call bridge">
          <div className="feed">
            {incidents.length === 0 ? <span>No open incidents 🎉</span> : null}
            {incidents.map((incident) => (
              <div key={incident.id} className="feed-row">
                <span className="feed-time">{incident.day.slice(5)}</span>
                <Badge tone={incident.severity === 'high' ? 'red' : incident.severity === 'medium' ? 'amber' : 'peri'}>
                  {incident.status}
                </Badge>
                <span>{incident.summary}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="North-star vs 90-day targets">
          {[
            { label: `Pool match rate ${rafiq.poolMatchRate}%`, pct: Math.min(100, (rafiq.poolMatchRate / 55) * 100), ok: rafiq.poolMatchRate >= 55 },
            { label: `Dine no-show ${dine.noShowRate}% (target <8%)`, pct: Math.min(100, (8 / Math.max(dine.noShowRate, 0.1)) * 100), ok: dine.noShowRate < 8 },
            { label: `Desk delivery median ${go.medianDelivery}m (target <18m)`, pct: Math.min(100, (18 / go.medianDelivery) * 100), ok: go.medianDelivery < 18 },
            { label: `AI tool accuracy ${ai.toolAccuracy}% (target ≥95%)`, pct: Math.min(100, (ai.toolAccuracy / 95) * 100), ok: ai.toolAccuracy >= 95 },
            { label: `Occupancy ${occupancy().ratePct}%`, pct: occupancy().ratePct, ok: occupancy().ratePct >= 75 },
          ].map((row) => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{row.label}</span>
                <Badge tone={row.ok ? 'green' : 'amber'}>{row.ok ? 'on track' : 'watch'}</Badge>
              </div>
              <div className="progress">
                <div style={{ width: `${Math.round(row.pct)}%`, background: row.ok ? 'var(--green)' : 'var(--amber)' }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
