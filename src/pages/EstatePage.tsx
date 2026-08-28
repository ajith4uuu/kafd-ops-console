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
import { estateKpis, lastN, type Range } from '../data/analytics';
import { ESTATE_OPS_DAILY, ESTATE_PARTNERS, type EstatePartnerRow } from '../data/seed';

export function EstatePage({ range }: { range: Range }) {
  const kpis = estateKpis(range);
  const ops = lastN(ESTATE_OPS_DAILY, range).map((d) => ({
    day: shortDay(d.day),
    laundry: d.laundry,
    housekeeping: d.housekeeping,
    roomService: d.roomService,
    slaPct: Math.round(((d.laundry + d.housekeeping + d.roomService - d.slaMissed) / (d.laundry + d.housekeeping + d.roomService)) * 100),
    allowed: d.gateAllowed,
    denied: d.gateDenied,
  }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Service orders" value={num(kpis.orders)} />
        <Kpi label="SLA compliance" value={`${kpis.slaPct}%`} />
        <Kpi label="Instant credits paid" value={sar(kpis.creditsPaid)} />
        <Kpi label="Gate entries allowed" value={num(kpis.gateAllowed)} />
        <Kpi label="Gate denials" value={num(kpis.gateDenied)} />
        <Kpi label="Partners live" value={`${kpis.partnersLive}/${ESTATE_PARTNERS.length}`} />
        <Kpi label="Partner gross" value={sar(kpis.partnerGross)} />
        <Kpi label="Platform commission" value={sar(kpis.commission)} />
      </div>

      <Card
        title="One core, four apps"
        foot="Resident ordering, captain execution, gate verification and partner supply all write to the same identity, payment and audit spine — a new service type plugs into this core, not a new system."
        data-testid="estate-core-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="green">Resident/Guest — demand</Badge>
          <Badge tone="peri">Captain — execution</Badge>
          <Badge tone="amber">Gate Security — verification</Badge>
          <Badge tone="green">Partner/Vendor — supply</Badge>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card
          title="Home-services volume & SLA"
          foot={`Missed promises auto-credit the resident wallet — ${sar(kpis.creditsPaid)} paid in window, and the rate is falling as captains densify.`}
          data-testid="estate-ops-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={ops}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis yAxisId="left" stroke={CHART.axis} fontSize={11} />
              <YAxis yAxisId="right" orientation="right" domain={[80, 100]} stroke={CHART.axis} fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: '#1d2740', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Area yAxisId="left" dataKey="laundry" name="Laundry" stackId="s" fill={CHART.amber} stroke={CHART.amber} fillOpacity={0.5} />
              <Area yAxisId="left" dataKey="housekeeping" name="Housekeeping" stackId="s" fill={CHART.peri} stroke={CHART.peri} fillOpacity={0.5} />
              <Area yAxisId="left" dataKey="roomService" name="Room service" stackId="s" fill={CHART.green} stroke={CHART.green} fillOpacity={0.5} />
              <Line yAxisId="right" dataKey="slaPct" name="SLA %" stroke="#fff" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Gate lane decisions"
          foot="Denials stay a thin band — blacklist matches, exhausted pools and expired passes; every decision lands in the audit trail with face capture on allow."
          data-testid="estate-gate-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={ops}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip contentStyle={{ background: '#1d2740', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Area dataKey="allowed" name="Allowed" stroke={CHART.green} fill={CHART.green} fillOpacity={0.35} />
              <Area dataKey="denied" name="Denied" stroke={CHART.red} fill={CHART.red} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card
        title="Partner register — settlement & commission"
        foot="Zero setup cost; the platform earns a per-category revenue share (15% laundry / 12% housekeeping / 18% room service) with 15% VAT on the commission, settled weekly to the registered IBAN."
        data-testid="estate-partners-card"
      >
        <DataTable<EstatePartnerRow>
          rowKey={(p) => p.id}
          columns={[
            { key: 'name', label: 'Partner', render: (p) => p.name },
            { key: 'agreement', label: 'Agreement', render: (p) => p.agreementNo },
            { key: 'category', label: 'Category', render: (p) => p.category.replace('_', ' ') },
            { key: 'gross', label: 'Gross', render: (p) => sar(p.grossSar) },
            { key: 'commission', label: `Commission`, render: (p) => sar(Math.round(p.grossSar * (p.commissionPct / 100))) },
            { key: 'rating', label: 'Rating', render: (p) => `★ ${p.rating.toFixed(2)}` },
            {
              key: 'status',
              label: 'Status',
              render: (p) => <Badge tone={p.status === 'live' ? 'green' : 'amber'}>{p.status === 'live' ? 'Live' : 'Onboarding'}</Badge>,
            },
          ]}
          rows={ESTATE_PARTNERS}
        />
      </Card>
    </>
  );
}
