import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, CHART, Card, DataTable, Kpi, num, sar } from '../components/ui';
import { hrKpis } from '../data/analytics';
import { EMPLOYEES, RECRUITMENT, WPS_RUNS, type Employee, type RecruitmentRole, type WpsRun } from '../data/seed';

const ATT_TONE: Record<Employee['attendance'], 'green' | 'peri' | 'amber' | 'red'> = {
  present: 'green',
  remote: 'peri',
  leave: 'amber',
  absent: 'red',
};

export function HrPage() {
  const kpis = hrKpis();
  const byDept = [...new Set(EMPLOYEES.map((e) => e.dept))].map((dept) => {
    const staff = EMPLOYEES.filter((e) => e.dept === dept);
    return {
      dept,
      present: staff.filter((e) => e.attendance === 'present' || e.attendance === 'remote').length,
      out: staff.filter((e) => e.attendance === 'leave' || e.attendance === 'absent').length,
    };
  });

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Headcount" value={num(kpis.headcount)} />
        <Kpi label="Attendance today" value={`${kpis.attendancePct}%`} />
        <Kpi label="On leave" value={String(kpis.onLeave)} />
        <Kpi label="Absent" value={String(kpis.absent)} />
        <Kpi label={`WPS run — ${kpis.wpsMonth}`} value={sar(kpis.wpsTotal)} />
        <Kpi label="Open roles" value={String(kpis.openRoles)} />
        <Kpi label="Hired this quarter" value={String(kpis.hiredQtd)} />
      </div>

      <div className="grid cols-2">
        <Card
          title="Attendance by department"
          foot="Captains and gate officers clock in against shift rosters; remote counts as present for payroll."
          data-testid="hr-attendance-card"
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byDept}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="dept" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1d2740', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Bar dataKey="present" name="In" stackId="a" fill={CHART.green} />
              <Bar dataKey="out" name="Out" stackId="a" fill={CHART.amber} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="WPS payroll runs"
          foot="Salaries file to the bank as WPS SIF submissions — basic + housing (25%) + allowances per Mudad rules; acceptance closes the month."
          data-testid="hr-wps-card"
        >
          <DataTable<WpsRun>
            rowKey={(r) => r.id}
            columns={[
              { key: 'month', label: 'Month', render: (r) => r.month },
              { key: 'sif', label: 'SIF reference', render: (r) => r.sifRef },
              { key: 'employees', label: 'Staff', render: (r) => String(r.employees) },
              { key: 'total', label: 'Total', render: (r) => sar(r.totalSar) },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <Badge tone={r.status === 'accepted' ? 'green' : r.status === 'submitted' ? 'amber' : 'peri'}>
                    {r.status}
                  </Badge>
                ),
              },
            ]}
            rows={WPS_RUNS}
          />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Team roster — today" data-testid="hr-roster-card">
          <DataTable<Employee>
            rowKey={(e) => e.id}
            columns={[
              { key: 'name', label: 'Employee', render: (e) => e.name },
              { key: 'dept', label: 'Department', render: (e) => e.dept },
              { key: 'pay', label: 'Monthly (B+H+A)', render: (e) => sar(e.basicSar + e.housingSar + e.otherSar) },
              {
                key: 'att',
                label: 'Today',
                render: (e) => <Badge tone={ATT_TONE[e.attendance]}>{e.attendance}</Badge>,
              },
            ]}
            rows={EMPLOYEES.slice(0, 12)}
          />
        </Card>

        <Card
          title="Recruitment pipeline"
          foot="Captains hire fastest — the funnel from application to offer runs ~2 weeks with Nafath-verified onboarding on day one."
          data-testid="hr-recruitment-card"
        >
          <DataTable<RecruitmentRole>
            rowKey={(r) => r.role}
            columns={[
              { key: 'role', label: 'Role', render: (r) => r.role },
              { key: 'applied', label: 'Applied', render: (r) => num(r.applied) },
              { key: 'screening', label: 'Screen', render: (r) => String(r.screening) },
              { key: 'interview', label: 'Interview', render: (r) => String(r.interview) },
              { key: 'offer', label: 'Offer', render: (r) => String(r.offer) },
              { key: 'hired', label: 'Hired', render: (r) => <Badge tone="green">{String(r.hired)}</Badge> },
            ]}
            rows={RECRUITMENT}
          />
        </Card>
      </div>
    </>
  );
}
