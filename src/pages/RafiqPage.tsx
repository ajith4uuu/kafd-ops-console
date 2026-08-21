import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar, shortDay } from '../components/ui';
import {
  co2Leaderboard,
  co2Program,
  driversAtRisk,
  lastN,
  rafiqKpis,
  scheduledKpis,
  topCorporateAccounts,
  trendPct,
  workProgram,
  type Range,
} from '../data/analytics';
import { DRIVERS, INCIDENTS, RIDES_DAILY, SCHEDULED_DAILY, type CorporateAccount, type Driver } from '../data/seed';

export function RafiqPage({ range }: { range: Range }) {
  const kpis = rafiqKpis(range);
  const co2 = co2Program(range);
  const window = lastN(RIDES_DAILY, range);
  const scheduled = scheduledKpis(range);
  const work = workProgram(range);
  const scheduledWindow = lastN(SCHEDULED_DAILY, range);
  const scheduledSeries = scheduledWindow.map((d) => ({
    day: shortDay(d.day),
    completed: d.completed,
    freeCancels: d.freeCancels,
    lateCancels: d.lateCancels,
    onTime: d.onTimePct || null,
  }));
  const workSeries = scheduledWindow.map((d, i) => {
    const total = window[i]?.total ?? 0;
    return {
      day: shortDay(d.day),
      workTrips: d.workTrips,
      share: total === 0 ? 0 : Math.round((d.workTrips / total) * 1000) / 10,
    };
  });

  const classMix = window.map((d) => ({ day: shortDay(d.day), ...d.byClass }));
  const matchSeries = window.map((d) => ({
    day: shortDay(d.day),
    matchRate: d.byClass.pool === 0 ? 0 : Math.round((d.poolMatched / d.byClass.pool) * 100),
    surge: d.surgePeak,
  }));
  const etaSeries = window.map((d) => ({ day: shortDay(d.day), p50: d.pickupEtaP50, p95: d.pickupEtaP95 }));
  const co2Series = co2.cumulative.map((p) => ({ day: shortDay(p.day), daily: p.kg, cumulative: p.cumulativeKg }));

  const rafiqIncidents = INCIDENTS.filter((incident) => incident.pillar === 'rafiq');

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Rides" value={num(kpis.rides)} trend={trendPct(RIDES_DAILY, range, (d) => d.total)} />
        <Kpi label="GMV" value={sar(kpis.gmv)} trend={trendPct(RIDES_DAILY, range, (d) => d.gmv)} />
        <Kpi label="Pool match rate" value={`${kpis.poolMatchRate}%`} />
        <Kpi label="Pickup ETA p50 / p95" value={`${kpis.etaP50} / ${kpis.etaP95}m`} />
        <Kpi label="Cancellation rate" value={`${kpis.cancellationRate}%`} trend={trendPct(RIDES_DAILY, range, (d) => d.cancellations)} invertTrend />
        <Kpi label="SOS events" value={String(kpis.sos)} />
        <Kpi label="Scheduled rides" value={num(scheduled.reserved)} trend={trendPct(SCHEDULED_DAILY, range, (d) => d.reserved)} />
        <Kpi label="Window on-time" value={`${scheduled.onTimePct}%`} />
        <Kpi label="Work trips" value={num(work.workTrips)} trend={trendPct(SCHEDULED_DAILY, range, (d) => d.workTrips)} />
        <Kpi label="Work share" value={`${work.workSharePct}%`} />
      </div>

      <div className="grid cols-2">
        <Card title="Rides by class (stacked)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={classMix}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={34} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pool" stackId="a" fill={CHART.green} />
              <Bar dataKey="go" stackId="a" fill={CHART.peri} />
              <Bar dataKey="comfort" stackId="a" fill={CHART.periDeep} />
              <Bar dataKey="xl" stackId="a" fill={CHART.amber} />
              <Bar dataKey="ladies" stackId="a" fill={CHART.red} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pool match rate vs surge peaks" foot="Flat KAFD fares stay surge-immune; surge applies to metered city trips only">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={matchSeries}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} width={34} domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} width={30} domain={[1, 2]} />
              <Tooltip />
              <Line yAxisId="l" type="monotone" dataKey="matchRate" stroke={CHART.green} dot={false} strokeWidth={2} name="match %" />
              <Line yAxisId="r" type="step" dataKey="surge" stroke={CHART.amber} dot={false} strokeWidth={1.5} name="surge peak" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card
          title="CO₂ program — Pool emissions avoided"
          foot={`${num(co2.totalKg)} kg total · ≈ ${num(co2.treesEquivalent)} trees/yr · ≈ ${num(co2.carKmEquivalent)} solo-car km avoided · ${co2.perPoolRideKg} kg per pool seat`}
          data-testid="co2-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={co2Series}>
              <defs>
                <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={44} />
              <Tooltip />
              <Area type="monotone" dataKey="cumulative" stroke={CHART.green} fill="url(#co2Fill)" strokeWidth={2} name="cumulative kg" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="District CO₂ leaderboard" foot="Gamified rider standings — monthly badges ship via notifications">
          {co2Leaderboard().map((row, i) => (
            <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ width: 22, color: 'var(--muted)', fontSize: 13 }}>#{i + 1}</span>
              <span style={{ width: 130, fontSize: 14 }}>{row.name}</span>
              <div className="progress" style={{ flex: 1 }}>
                <div style={{ width: `${(row.kg / co2Leaderboard()[0].kg) * 100}%` }} />
              </div>
              <span style={{ width: 70, textAlign: 'right', fontSize: 13.5 }}>{row.kg} kg</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Pickup ETA — p50 vs p95 (min)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={etaSeries}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis stroke={CHART.axis} fontSize={11} width={30} />
              <Tooltip />
              <Line type="monotone" dataKey="p50" stroke={CHART.peri} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="p95" stroke={CHART.red} dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Safety log (Rafiq)">
          <div className="feed">
            {rafiqIncidents.map((incident) => (
              <div key={incident.id} className="feed-row">
                <span className="feed-time">{incident.day.slice(5)} {incident.time}</span>
                <Badge tone={incident.status === 'resolved' ? 'green' : incident.status === 'investigating' ? 'amber' : 'red'}>
                  {incident.status}
                </Badge>
                <span>{incident.summary}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card
          title="Scheduled rides — outcomes & window adherence"
          foot={`${scheduled.completionPct}% completed · ${scheduled.lateCancelPct}% late cancels (SAR ${scheduled.lateCancelFeesSar} in fees) · captains arrive in the 10-min window ${scheduled.onTimePct}% of the time`}
          data-testid="scheduled-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={scheduledSeries}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} width={30} />
              <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} width={34} domain={[80, 100]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="l" dataKey="completed" stackId="s" fill={CHART.peri} name="completed" />
              <Bar yAxisId="l" dataKey="freeCancels" stackId="s" fill={CHART.periDeep} name="free cancel" />
              <Bar yAxisId="l" dataKey="lateCancels" stackId="s" fill={CHART.red} name="late cancel" />
              <Line yAxisId="r" type="monotone" dataKey="onTime" stroke={CHART.green} dot={false} strokeWidth={2} name="on-time %" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Work rides program"
          foot={`${sar(work.workGmv)} work GMV · ${work.activeAccounts} active corporate accounts · receipts forward to expense providers monthly`}
          data-testid="work-card"
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={workSeries}>
              <defs>
                <linearGradient id="workFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.amber} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.amber} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="day" stroke={CHART.axis} fontSize={11} minTickGap={28} />
              <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} width={30} />
              <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} width={34} unit="%" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="l" type="monotone" dataKey="workTrips" stroke={CHART.amber} fill="url(#workFill)" strokeWidth={2} name="work trips" />
              <Line yAxisId="r" type="monotone" dataKey="share" stroke={CHART.peri} dot={false} strokeWidth={1.5} name="share of rides %" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Corporate accounts" foot="Sorted by 30-day work GMV — onboarding accounts ride before expense integration completes">
        <DataTable<CorporateAccount>
          rowKey={(account) => account.id}
          columns={[
            { key: 'company', label: 'Company', render: (a) => a.company },
            { key: 'riders', label: 'Riders', render: (a) => num(a.riders) },
            { key: 'trips', label: 'Work trips (30d)', render: (a) => num(a.workTrips30d) },
            { key: 'gmv', label: 'Work GMV (30d)', render: (a) => sar(a.workGmv30d) },
            { key: 'provider', label: 'Expense provider', render: (a) => a.expenseProvider },
            {
              key: 'status',
              label: 'Status',
              render: (a) => <Badge tone={a.status === 'active' ? 'green' : 'amber'}>{a.status}</Badge>,
            },
          ]}
          rows={topCorporateAccounts()}
        />
      </Card>

      <Card title="Driver standings" foot={`${driversAtRisk().length} drivers flagged for review (acceptance <85%, cancellation ≥5% or status)`}>
        <DataTable<Driver>
          rowKey={(d) => d.id}
          columns={[
            { key: 'name', label: 'Driver', render: (d) => d.name },
            { key: 'rating', label: 'Rating', render: (d) => `★ ${d.rating}` },
            { key: 'acceptance', label: 'Acceptance', render: (d) => `${d.acceptance}%` },
            { key: 'cancellation', label: 'Cancellation', render: (d) => `${d.cancellation}%` },
            { key: 'trips', label: 'Trips (90d)', render: (d) => num(d.trips90d) },
            {
              key: 'status',
              label: 'Standing',
              render: (d) => (
                <Badge tone={d.status === 'active' ? 'green' : d.status === 'review' ? 'amber' : 'red'}>{d.status}</Badge>
              ),
            },
          ]}
          rows={DRIVERS}
        />
      </Card>
    </>
  );
}
