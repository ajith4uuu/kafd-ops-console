import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar, shortDay } from '../components/ui';
import { complianceKpis, lastN, type Range } from '../data/analytics';
import { EJAR_CONTRACTS, SHORT_STAY_DAILY, type EjarContract } from '../data/seed';

export function CompliancePage({ range }: { range: Range }) {
  const kpis = complianceKpis(range);
  const stays = lastN(SHORT_STAY_DAILY, range).map((d) => ({
    day: shortDay(d.day),
    occupancy: Math.round((d.occupied / d.units) * 100),
    adr: d.adr,
    revenue: d.revenue,
  }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Ejar registered" value={`${kpis.registered}/${kpis.contracts}`} />
        <Kpi label="Registration rate" value={`${kpis.registeredPct}%`} />
        <Kpi label="Deposit-cap compliance" value={`${kpis.depositCapPct}%`} />
        <Kpi label="ZATCA e-invoices" value={num(kpis.zatcaInvoices)} />
        <Kpi label="Freeze-blocked increases" value={String(kpis.freezeBlocked)} />
        <Kpi label="Renewals due" value={String(kpis.renewalsDue)} />
        <Kpi label="Short-stay occupancy" value={`${kpis.stayOccupancyPct}%`} />
        <Kpi label="Short-stay ADR" value={sar(Math.round(kpis.stayAdr))} />
      </div>

      <Card
        title="Riyadh rent freeze — active guardrail"
        foot="Royal Decree (25 Sep 2025): residential and commercial rents inside the Riyadh urban boundary are frozen to 2030. The console refuses renewal uplifts automatically; three were blocked this quarter."
        data-testid="freeze-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="amber">Freeze active → 2030</Badge>
          <Badge tone="green">Deposits capped at 5% of lease value</Badge>
          <Badge tone="green">Brokerage capped at 2.5% of annual rent</Badge>
          <Badge tone="peri">Short stays require a Ministry of Tourism licence</Badge>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card
          title="Licensed short stays — occupancy & ADR"
          foot={`${sar(kpis.stayRevenue)} revenue in window · ${sar(kpis.stayVat)} VAT collected at 15% · every receipt carries a ZATCA TLV QR`}
          data-testid="stays-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={stays}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} width={34} unit="%" domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} width={44} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="l" type="monotone" dataKey="occupancy" stroke={CHART.peri} fill={CHART.peri} fillOpacity={0.18} name="occupancy %" />
              <Line yAxisId="r" type="monotone" dataKey="adr" stroke={CHART.amber} dot={false} strokeWidth={2} name="ADR (SAR)" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Short-stay revenue (15% VAT itemised)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stays}>
              <defs>
                <linearGradient id="stayFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={50} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke={CHART.green} fill="url(#stayFill)" strokeWidth={2} name="SAR / day" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Ejar contract register" foot="Every e-signed lease is submitted to the national rental network; registration numbers are the system of record.">
        <DataTable<EjarContract>
          rowKey={(c) => c.id}
          columns={[
            { key: 'id', label: 'Ejar no.', render: (c) => c.id },
            { key: 'unit', label: 'Unit', render: (c) => c.unit },
            { key: 'rent', label: 'Annual rent', render: (c) => sar(c.annualRent) },
            {
              key: 'deposit',
              label: 'Deposit (cap 5%)',
              render: (c) => `${sar(c.depositSar)} · ${Math.round((c.depositSar / c.annualRent) * 1000) / 10}%`,
            },
            {
              key: 'status',
              label: 'Status',
              render: (c) => (
                <Badge tone={c.status === 'registered' ? 'green' : c.status === 'renewal_due' ? 'amber' : 'peri'}>
                  {c.status.replace('_', ' ')}
                </Badge>
              ),
            },
            { key: 'day', label: 'Registered', render: (c) => c.registeredDay },
          ]}
          rows={EJAR_CONTRACTS}
        />
      </Card>
    </>
  );
}
