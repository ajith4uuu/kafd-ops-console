import { useState } from 'react';
import { Badge, Card, DataTable, Kpi, num } from '../components/ui';
import { controlKpis, sodViolations } from '../data/analytics';
import { ADMINS, PERMISSIONS, ROLE_CATALOG, type AdminUser } from '../data/seed';

const DIVISION_LABEL: Record<AdminUser['division'], string> = {
  platform: 'Platform',
  mobility: 'Mobility',
  property: 'Property',
  hospitality: 'Hospitality',
  estate: 'Estate',
  finance: 'Finance',
  people: 'People',
  security: 'Security',
};

/** The matrix shows the eight permissions that decide real blast radius. */
const MATRIX_PERMS = ['manage_users', 'invite_admin', 'approve_access', 'prepare_payout', 'approve_payout', 'run_payroll', 'manage_blacklist', 'view_audit'] as const;

export function AdminsPage() {
  const kpis = controlKpis();
  const violations = sodViolations();
  const [suspended, setSuspended] = useState<Record<string, boolean>>({});

  const rows = ADMINS.map((a) => ({ ...a, status: suspended[a.id] ? ('suspended' as const) : a.status }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Admins" value={num(kpis.admins)} />
        <Kpi label="Super admins" value={`${kpis.superAdmins}/${kpis.superAdminCap} cap`} />
        <Kpi label="MFA coverage" value={`${kpis.mfaPct}%`} />
        <Kpi label="Nafath pending" value={String(kpis.nafathPending)} />
        <Kpi label="SoD violations" value={String(kpis.sodViolations)} />
        <Kpi label="Stale accounts (30d)" value={String(kpis.stale)} />
        <Kpi label="Pending requests" value={String(kpis.pendingRequests)} />
        <Kpi label="Q3 review progress" value={`${kpis.reviewPct}%`} />
      </div>

      <Card
        title="Least privilege, enforced"
        foot="Every admin holds exactly one role; roles map to divisions; the super-admin seat is capped at three, Nafath-verified, and every grant or suspension writes to the audit trail."
        data-testid="iam-principles-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone={violations.length === 0 ? 'green' : 'red'}>
            {violations.length === 0 ? 'SoD clean — no maker approves their own work' : `${violations.length} SoD conflicts`}
          </Badge>
          <Badge tone="peri">Maker–checker on every payout & refund</Badge>
          <Badge tone="amber">Break-glass alarmed & audited</Badge>
          <Badge tone="green">Quarterly access recertification</Badge>
        </div>
      </Card>

      <Card
        title="Role catalog — permission matrix"
        foot="Forbidden pairs (prepare+approve payout, issue+approve refund, payroll+payout, invite+approve access) can never be granted to one person — the catalog itself makes the conflict unrepresentable."
        data-testid="role-matrix-card"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                {MATRIX_PERMS.map((p) => (
                  <th key={p} style={{ fontSize: 11 }}>{PERMISSIONS.find((x) => x.id === p)?.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_CATALOG.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}{r.maxHolders ? ` (max ${r.maxHolders})` : ''}</td>
                  {MATRIX_PERMS.map((p) => (
                    <td key={p} style={{ textAlign: 'center', color: r.permissions.includes(p) ? '#7ecb93' : 'rgba(255,255,255,0.18)' }}>
                      {r.permissions.includes(p) ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Admin directory"
        foot="Suspend cuts every session immediately and freezes role assignments; reactivation needs a division-admin request plus super-admin approval."
        data-testid="admin-directory-card"
      >
        <DataTable<(typeof rows)[number]>
          rowKey={(a) => a.id}
          columns={[
            { key: 'name', label: 'Admin', render: (a) => a.name },
            { key: 'division', label: 'Division', render: (a) => DIVISION_LABEL[a.division] },
            { key: 'role', label: 'Role', render: (a) => ROLE_CATALOG.find((r) => r.id === a.role)?.label ?? a.role },
            { key: 'mfa', label: 'MFA', render: (a) => <Badge tone={a.mfa ? 'green' : 'red'}>{a.mfa ? 'On' : 'Off'}</Badge> },
            { key: 'nafath', label: 'Nafath', render: (a) => <Badge tone={a.nafathVerified ? 'green' : 'amber'}>{a.nafathVerified ? 'Verified' : 'Pending'}</Badge> },
            {
              key: 'status',
              label: 'Status',
              render: (a) => (
                <Badge tone={a.status === 'active' ? 'green' : a.status === 'invited' ? 'peri' : 'red'}>{a.status}</Badge>
              ),
            },
            {
              key: 'action',
              label: '',
              render: (a) =>
                a.role === 'super_admin' ? (
                  <span style={{ fontSize: 11, opacity: 0.5 }}>protected</span>
                ) : (
                  <button
                    className="btn"
                    onClick={() => setSuspended((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                  >
                    {suspended[a.id] ? 'Reinstate' : 'Suspend'}
                  </button>
                ),
            },
          ]}
          rows={rows}
        />
      </Card>
    </>
  );
}
