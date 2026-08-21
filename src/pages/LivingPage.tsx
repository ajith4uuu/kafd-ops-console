import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar } from '../components/ui';
import { arrearsAging, occupancy, rentCollection, woByStatus, woSlaByPriority } from '../data/analytics';
import { BUILDINGS, WORK_ORDERS, type WorkOrder } from '../data/seed';

const FUNNEL = [
  { stage: 'Listing views', value: 4820 },
  { stage: 'Walkthrough plays', value: 3105 },
  { stage: 'Viewings booked', value: 402 },
  { stage: 'Applications', value: 141 },
  { stage: 'Leases signed', value: 58 },
];

export function LivingPage() {
  const occ = occupancy();
  const rent = rentCollection();
  const statuses = woByStatus();
  const sla = woSlaByPriority();
  const aging = arrearsAging();
  const openWos = WORK_ORDERS.filter((wo) => wo.status !== 'resolved');

  const occupancyBars = BUILDINGS.map((b) => ({
    building: b.code,
    leased: b.leased,
    reserved: b.reserved,
    vacant: b.units - b.leased - b.reserved,
  }));

  const statusPie = [
    { name: 'open', value: statuses.open, color: CHART.red },
    { name: 'scheduled', value: statuses.scheduled, color: CHART.amber },
    { name: 'in progress', value: statuses.in_progress, color: CHART.peri },
    { name: 'resolved', value: statuses.resolved, color: CHART.green },
  ];

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Occupancy" value={`${occ.ratePct}%`} />
        <Kpi label="Units leased" value={`${occ.leased} / ${occ.units}`} />
        <Kpi label="Rent collected" value={`${rent.collectedPct}%`} />
        <Kpi label="Arrears" value={sar(aging.reduce((a, b) => a + b.amount, 0))} />
        <Kpi label="Open work orders" value={String(openWos.length)} />
        <Kpi label="Walkthrough coverage" value={`${occ.walkthroughCoverage}%`} />
      </div>

      <div className="grid cols-3">
        <Card title="Occupancy by building">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={occupancyBars}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="building" stroke={CHART.axis} fontSize={12} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} />
              <Tooltip />
              <Bar dataKey="leased" stackId="a" fill={CHART.green} />
              <Bar dataKey="reserved" stackId="a" fill={CHART.amber} />
              <Bar dataKey="vacant" stackId="a" fill="rgba(255,255,255,0.18)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Work orders by status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                {statusPie.map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
            {statusPie.map((slice) => (
              <span key={slice.name} style={{ color: 'var(--text-2)' }}>
                <span style={{ color: slice.color }}>●</span> {slice.name} {slice.value}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Maintenance SLA compliance" foot="P1 target: response < 2h (building ops paged instantly)">
          {sla.map((row) => (
            <div key={row.priority} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                <span>
                  {row.priority} · {row.withinSla}/{row.total} within SLA
                </span>
                <Badge tone={row.compliancePct >= 90 ? 'green' : row.compliancePct >= 80 ? 'amber' : 'red'}>
                  {row.compliancePct}%
                </Badge>
              </div>
              <div className="progress">
                <div
                  style={{
                    width: `${row.compliancePct}%`,
                    background: row.compliancePct >= 90 ? 'var(--green)' : 'var(--amber)',
                  }}
                />
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Leasing funnel — views → walkthroughs → leases" foot="AI walkthroughs lift viewing→application conversion (+30% target)">
          {FUNNEL.map((step, i) => (
            <div key={step.stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ width: 150, fontSize: 13.5 }}>{step.stage}</span>
              <div className="progress" style={{ flex: 1, height: 14 }}>
                <div
                  style={{
                    width: `${(step.value / FUNNEL[0].value) * 100}%`,
                    background: i === FUNNEL.length - 1 ? 'var(--green)' : 'var(--peri)',
                  }}
                />
              </div>
              <span style={{ width: 60, textAlign: 'right', fontSize: 13.5 }}>{num(step.value)}</span>
            </div>
          ))}
        </Card>

        <Card title="Arrears aging">
          <DataTable
            rowKey={(row) => row.bucket}
            columns={[
              { key: 'bucket', label: 'Bucket', render: (row) => row.bucket },
              { key: 'count', label: 'Invoices', render: (row) => String(row.count) },
              { key: 'amount', label: 'Amount', render: (row) => sar(row.amount) },
              {
                key: 'risk',
                label: 'Action',
                render: (row) => (
                  <Badge tone={row.bucket === '>60d' ? 'red' : row.bucket === '31–60d' ? 'amber' : 'peri'}>
                    {row.bucket === '>60d' ? 'legal review' : row.bucket === '31–60d' ? 'final notice' : 'reminder'}
                  </Badge>
                ),
              },
            ]}
            rows={aging}
          />
        </Card>
      </div>

      <Card title="Open work-order queue" foot="Assignment + vendor changes are audit-logged">
        <DataTable<WorkOrder>
          rowKey={(wo) => wo.id}
          columns={[
            { key: 'id', label: 'WO', render: (wo) => wo.id },
            { key: 'unit', label: 'Unit', render: (wo) => wo.unit },
            { key: 'category', label: 'Category', render: (wo) => wo.category },
            {
              key: 'priority',
              label: 'Priority',
              render: (wo) => (
                <Badge tone={wo.priority === 'P1' ? 'red' : wo.priority === 'P2' ? 'amber' : 'peri'}>{wo.priority}</Badge>
              ),
            },
            { key: 'vendor', label: 'Vendor', render: (wo) => wo.vendor },
            { key: 'opened', label: 'Opened', render: (wo) => wo.openedDay.slice(5) },
            {
              key: 'status',
              label: 'Status',
              render: (wo) => (
                <Badge tone={wo.status === 'open' ? 'red' : wo.status === 'scheduled' ? 'amber' : 'peri'}>{wo.status}</Badge>
              ),
            },
          ]}
          rows={openWos.slice(0, 12)}
        />
      </Card>
    </>
  );
}
