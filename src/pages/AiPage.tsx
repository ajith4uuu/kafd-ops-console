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
import { Badge, CHART, Card, DataTable, Kpi, num, shortDay } from '../components/ui';
import { aiKpis, lastN, trendPct, type Range } from '../data/analytics';
import { AI_DAILY } from '../data/seed';

const INTENT_MIX = [
  { intent: 'book_table', share: 26 },
  { intent: 'ride_quote', share: 21 },
  { intent: 'order_food', share: 17 },
  { intent: 'plan_evening', share: 11 },
  { intent: 'find_parking', share: 10 },
  { intent: 'find_units', share: 7 },
  { intent: 'district_info', share: 5 },
  { intent: 'events', share: 3 },
];

const GUARDRAILS = [
  { name: 'Prompt-injection defense (RAG wrap + strip)', status: 'enforced' },
  { name: 'Tool allow-list per role', status: 'enforced' },
  { name: 'Human confirmation on all mutations', status: 'enforced' },
  { name: 'PII redaction pre-logging', status: 'enforced' },
  { name: 'Per-feature daily spend caps', status: 'enforced' },
  { name: 'AR/EN eval parity (±3%)', status: 'passing' },
];

export function AiPage({ range }: { range: Range }) {
  const kpis = aiKpis(range);
  const window = lastN(AI_DAILY, range);
  const sessions = window.map((d) => ({ day: shortDay(d.day), sessions: d.sessions, transactions: d.transactionsInitiated }));
  const accuracy = window.map((d) => ({
    day: shortDay(d.day),
    accuracy: d.toolCalls === 0 ? 0 : Math.round((d.toolSuccess / d.toolCalls) * 1000) / 10,
    arShare: Math.round(d.arShare * 100),
  }));
  const cost = window.map((d) => ({ day: shortDay(d.day), cost: d.costSar }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Sessions" value={num(kpis.sessions)} trend={trendPct(AI_DAILY, range, (d) => d.sessions)} />
        <Kpi label="Tool-call accuracy" value={`${kpis.toolAccuracy}%`} />
        <Kpi label="Arabic share" value={`${kpis.arShare}%`} />
        <Kpi label="Transactions initiated" value={num(kpis.transactions)} trend={trendPct(AI_DAILY, range, (d) => d.transactionsInitiated)} />
        <Kpi label="Cost / assisted transaction" value={`SAR ${kpis.costPerTransaction}`} />
      </div>

      <div className="grid cols-2">
        <Card title="Sessions & concierge-initiated transactions" foot="Target: 30% of bookings/orders initiated via concierge">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={sessions}>
              <defs>
                <linearGradient id="sessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.peri} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART.peri} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Area type="monotone" dataKey="sessions" stroke={CHART.peri} fill="url(#sessFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="transactions" stroke={CHART.green} fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tool accuracy vs Arabic share (%)" foot="Eval gate: accuracy ≥95%, AR quality parity within ±3% of EN">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={accuracy}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} domain={[30, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="accuracy" stroke={CHART.green} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="arShare" stroke={CHART.amber} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-3">
        <Card title="Intent mix (share of sessions)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={INTENT_MIX} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" stroke={CHART.axis} fontSize={11} />
              <YAxis type="category" dataKey="intent" stroke={CHART.axis} fontSize={12} width={90} />
              <Tooltip />
              <Bar dataKey="share" fill={CHART.periDeep} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Daily model spend (SAR)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={cost}>
              <defs>
                <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.amber} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART.amber} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Area type="monotone" dataKey="cost" stroke={CHART.amber} fill="url(#costFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Guardrails" foot="Every mutation requires an explicit user tap — enforced client-side today, orchestrator-side at GA">
          <DataTable
            rowKey={(row) => row.name}
            columns={[
              { key: 'name', label: 'Control', render: (row) => row.name },
              { key: 'status', label: 'Status', render: (row) => <Badge tone="green">{row.status}</Badge> },
            ]}
            rows={GUARDRAILS}
          />
        </Card>
      </div>
    </>
  );
}
