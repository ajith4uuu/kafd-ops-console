import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar, shortDay } from '../components/ui';
import { lastN, type Range } from '../data/analytics';
import {
  ACTIVE_DAILY,
  COHORTS,
  LOYALTY_DAILY,
  OFFER_PERFORMANCE,
  TIER_MIX,
  loyaltyKpis,
  stickiness,
} from '../data/growth';

function cohortColor(pct: number): string {
  const alpha = 0.12 + (pct / 100) * 0.85;
  return `rgba(126, 203, 147, ${alpha})`;
}

export function GrowthPage({ range }: { range: Range }) {
  const actives = lastN(ACTIVE_DAILY, range);
  const loyaltyWindow = lastN(LOYALTY_DAILY, range);
  const loyalty = loyaltyKpis(loyaltyWindow);
  const dauSeries = actives.map((d) => ({ day: shortDay(d.day), dau: d.dau, wau: d.wau }));
  const pointsSeries = loyaltyWindow.map((d) => ({ day: shortDay(d.day), issued: d.pointsIssued, redeemed: d.pointsRedeemed }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="DAU (latest)" value={num(actives[actives.length - 1].dau)} />
        <Kpi label="Stickiness DAU/WAU" value={`${stickiness(actives)}%`} />
        <Kpi label="Rewards members" value={num(loyalty.members)} />
        <Kpi label="Points issued" value={num(loyalty.pointsIssued)} />
        <Kpi label="Redemption rate" value={`${loyalty.redemptionRate}%`} />
        <Kpi label="Points liability" value={sar(loyalty.liabilitySar)} />
      </div>

      <div className="grid cols-2">
        <Card title="Daily & weekly actives">
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={dauSeries}>
              <defs>
                <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.peri} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.peri} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={40} />
              <Tooltip />
              <Area type="monotone" dataKey="wau" stroke={CHART.periDeep} fill="transparent" strokeWidth={1.5} />
              <Area type="monotone" dataKey="dau" stroke={CHART.peri} fill="url(#dauFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Points issued vs redeemed" foot="Liability accrues at 500 pts = SAR 5; finance sees it monthly">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={pointsSeries}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={50} />
              <Tooltip />
              <Line type="monotone" dataKey="issued" stroke={CHART.amber} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="redeemed" stroke={CHART.green} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card
          title="Weekly retention cohorts (% active N weeks after signup)"
          foot="Newer cohorts retain better as pillars launched — the superapp effect"
        >
          <div className="heat" style={{ gridTemplateColumns: `110px repeat(8, 1fr)` }}>
            <span className="hlabel" />
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="hlabel" style={{ justifyContent: 'center' }}>
                W{i}
              </span>
            ))}
            {COHORTS.map((cohort) => (
              <CohortRow key={cohort.week} cohort={cohort} />
            ))}
          </div>
        </Card>

        <Card title="Tier mix">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={TIER_MIX as never} dataKey="members" nameKey="tier" innerRadius={48} outerRadius={80} paddingAngle={3}>
                {TIER_MIX.map((slice) => (
                  <Cell key={slice.tier} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 12.5 }}>
            {TIER_MIX.map((slice) => (
              <span key={slice.tier} style={{ color: 'var(--text-2)' }}>
                <span style={{ color: slice.color }}>●</span> {slice.tier} {num(slice.members)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Offer performance" foot="Redemption ÷ claims — gold-gated offers convert hardest">
        <DataTable
          rowKey={(o) => o.id}
          columns={[
            { key: 'title', label: 'Offer', render: (o) => o.title },
            { key: 'pillar', label: 'Pillar', render: (o) => <span className={`pillar-chip pillar-${o.pillar === 'workplay' ? 'living' : o.pillar}`}>{o.pillar}</span> },
            { key: 'claims', label: 'Claims', render: (o) => num(o.claims) },
            { key: 'red', label: 'Redemptions', render: (o) => num(o.redemptions) },
            {
              key: 'conv',
              label: 'Conversion',
              render: (o) => {
                const pct = Math.round((o.redemptions / o.claims) * 100);
                return <Badge tone={pct >= 70 ? 'green' : pct >= 55 ? 'peri' : 'amber'}>{pct}%</Badge>;
              },
            },
          ]}
          rows={[...OFFER_PERFORMANCE].sort((a, b) => b.claims - a.claims)}
        />
      </Card>
    </>
  );
}

function CohortRow({ cohort }: { cohort: (typeof COHORTS)[number] }) {
  return (
    <>
      <span className="hlabel">
        {cohort.week.slice(5)} · {cohort.size}
      </span>
      {Array.from({ length: 8 }, (_, week) => {
        const value = cohort.retention[week];
        return value == null ? (
          <span key={week} />
        ) : (
          <span key={week} className="hcell" style={{ background: cohortColor(value), color: value > 55 ? '#0a1424' : 'var(--text-2)' }}>
            {value}
          </span>
        );
      })}
    </>
  );
}
