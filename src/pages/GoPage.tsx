import {
  Area,
  AreaChart,
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
import { Badge, CHART, Card, DataTable, Kpi, num, sar, shortDay } from '../components/ui';
import { goKpis, lastN, trendPct, type Range } from '../data/analytics';
import { INCIDENTS, MERCHANTS, ORDERS_DAILY, R, type Merchant } from '../data/seed';

// Deterministic per-merchant order share for the league table.
const MERCHANT_SHARE: Record<string, number> = { 'go-12-cups': 0.27, 'go-apple-butter': 0.2, 'go-pistrina': 0.17, 'go-kanto': 0.16, 'go-kunooz': 0.12, 'go-bateel': 0.08 };

export function GoPage({ range }: { range: Range }) {
  const kpis = goKpis(range);
  const window = lastN(ORDERS_DAILY, range);
  const orders = window.map((d) => ({ day: shortDay(d.day), orders: d.orders, desk: Math.round(d.orders * d.deskShare) }));
  const sla = window.map((d) => ({ day: shortDay(d.day), median: d.medianDeliveryMin, p90: d.p90DeliveryMin }));
  const util = window.map((d) => ({ day: shortDay(d.day), pct: Math.round(d.courierUtilization * 100) }));
  const goIncidents = INCIDENTS.filter((incident) => incident.pillar === 'go');

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Orders" value={num(kpis.orders)} trend={trendPct(ORDERS_DAILY, range, (d) => d.orders)} />
        <Kpi label="GMV" value={sar(kpis.gmv)} trend={trendPct(ORDERS_DAILY, range, (d) => d.gmv)} />
        <Kpi label="Delivery-to-desk share" value={`${kpis.deskShare}%`} />
        <Kpi label="Median delivery" value={`${kpis.medianDelivery}m`} invertTrend trend={trendPct(ORDERS_DAILY, range, (d) => d.medianDeliveryMin)} />
        <Kpi label="Order-issue rate" value={`${kpis.issueRate}%`} />
        <Kpi label="Courier utilization" value={`${kpis.courierUtilization}%`} />
      </div>

      <div className="grid cols-2">
        <Card title="Orders per day (desk deliveries highlighted)">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={orders}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Bar dataKey="orders" fill={CHART.peri} radius={[3, 3, 0, 0]} />
              <Bar dataKey="desk" fill={CHART.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Delivery time — median vs p90 (min)" foot="PRD target: desk-delivery median < 18 min">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={sla}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} />
              <Tooltip />
              <Line type="monotone" dataKey="median" stroke={CHART.green} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="p90" stroke={CHART.amber} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Courier utilization (%)">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={util}>
              <defs>
                <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.periDeep} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART.periDeep} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} domain={[0, 100]} />
              <Tooltip />
              <Area type="monotone" dataKey="pct" stroke={CHART.periDeep} fill="url(#utilFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Logistics exceptions">
          <div className="feed">
            {goIncidents.map((incident) => (
              <div key={incident.id} className="feed-row">
                <span className="feed-time">{incident.day.slice(5)} {incident.time}</span>
                <Badge tone={incident.status === 'resolved' ? 'green' : 'amber'}>{incident.status}</Badge>
                <span>{incident.summary}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Merchant league table" foot="86'd items and busy-mode changes appear in the audit log">
        <DataTable<Merchant>
          rowKey={(m) => m.id}
          columns={[
            { key: 'name', label: 'Merchant', render: (m) => m.name },
            { key: 'category', label: 'Category', render: (m) => <Badge tone="peri">{m.category}</Badge> },
            { key: 'orders', label: `Orders (${range}d)`, render: (m) => num(Math.round(kpis.orders * (MERCHANT_SHARE[m.id] ?? 0.1))) },
            { key: 'prep', label: 'Avg prep', render: (m) => `${m.prepMin}m` },
            { key: 'rating', label: 'Rating', render: (m) => `★ ${m.rating}` },
            {
              key: 'health',
              label: 'Health',
              render: (m) => <Badge tone={m.prepMin <= 12 ? 'green' : 'amber'}>{m.prepMin <= 12 ? 'fast' : 'monitor prep'}</Badge>,
            },
          ]}
          rows={MERCHANTS}
        />
      </Card>
    </>
  );
}

// Keep the seeded RNG import used (deterministic ordering elsewhere).
void R;
