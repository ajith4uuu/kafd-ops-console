import { useState } from 'react';
import { Badge, Card, DataTable, Kpi, num, sar } from '../components/ui';
import { financeControlKpis } from '../data/analytics';
import { APPROVAL_LIMITS, FINANCE_QUEUE, ROLE_CATALOG, type FinanceApproval } from '../data/seed';

const TYPE_LABEL: Record<FinanceApproval['type'], string> = {
  partner_payout: 'Partner payout',
  resident_refund: 'Resident refund',
  invoice_adjustment: 'Invoice adjustment',
};

/** The signed-in checker for this demo session. */
const CURRENT_CHECKER = 'Aisha Zahrani';
const CHECKER_LIMIT = APPROVAL_LIMITS.find((l) => l.role === 'finance_checker')?.limitSar ?? 0;

export function FinanceOpsPage() {
  const kpis = financeControlKpis();
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});

  const statusOf = (f: FinanceApproval): FinanceApproval['status'] => decisions[f.id] ?? f.status;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Pending approvals" value={String(kpis.pendingCount)} />
        <Kpi label="Pending value" value={sar(kpis.pendingValue)} />
        <Kpi label="Oldest pending" value={`${kpis.oldestHours}h`} />
        <Kpi label="Dual-control rate" value={`${kpis.dualControlPct}%`} />
        <Kpi label="Over single-sign limit" value={String(kpis.overLimit)} />
        <Kpi label="Queue depth (total)" value={num(FINANCE_QUEUE.length)} />
      </div>

      <Card
        title="Dual control — how money leaves the platform"
        foot="A maker prepares, a different checker approves; the console refuses self-approval outright. Items above the checker's single-sign limit escalate to a super admin as second checker."
        data-testid="dual-control-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="green">Maker ≠ checker, enforced</Badge>
          <Badge tone="peri">Checker limit {sar(CHECKER_LIMIT)}</Badge>
          <Badge tone="amber">Above limit → super-admin co-sign</Badge>
          <Badge tone="green">Every decision in the audit trail</Badge>
        </div>
      </Card>

      <Card
        title={`Approval queue — signed in as ${CURRENT_CHECKER} (Finance Checker)`}
        foot="Rows made by the signed-in checker show no approve control: self-approval is not a permission that exists."
        data-testid="finance-queue-card"
      >
        <DataTable<FinanceApproval>
          rowKey={(f) => f.id}
          columns={[
            { key: 'ref', label: 'Reference', render: (f) => f.ref },
            { key: 'type', label: 'Type', render: (f) => TYPE_LABEL[f.type] },
            { key: 'division', label: 'Division', render: (f) => f.division },
            { key: 'amount', label: 'Amount', render: (f) => sar(f.amountSar) },
            { key: 'maker', label: 'Maker', render: (f) => f.maker },
            {
              key: 'checker',
              label: 'Checker',
              render: (f) => (statusOf(f) === 'pending' ? '—' : decisions[f.id] ? CURRENT_CHECKER : f.checker ?? '—'),
            },
            { key: 'age', label: 'Age', render: (f) => `${f.ageHours}h` },
            {
              key: 'status',
              label: 'Status',
              render: (f) => {
                const s = statusOf(f);
                if (s !== 'pending') {
                  return <Badge tone={s === 'approved' ? 'green' : 'red'}>{s}</Badge>;
                }
                const overLimit = f.amountSar > CHECKER_LIMIT;
                const selfMade = f.maker === CURRENT_CHECKER;
                if (selfMade) return <Badge tone="red">own item — blocked</Badge>;
                if (overLimit) return <Badge tone="amber">needs super-admin co-sign</Badge>;
                return (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <button className="btn primary" onClick={() => setDecisions((p) => ({ ...p, [f.id]: 'approved' }))}>Approve</button>
                    <button className="btn" onClick={() => setDecisions((p) => ({ ...p, [f.id]: 'rejected' }))}>Reject</button>
                  </span>
                );
              },
            },
          ]}
          rows={FINANCE_QUEUE}
        />
      </Card>

      <Card
        title="Single-approval ceilings"
        foot="Limits are per decision, not per day — structuring a payout into smaller tranches to dodge a ceiling trips the same-payee velocity alarm."
        data-testid="limits-card"
      >
        <DataTable<(typeof APPROVAL_LIMITS)[number]>
          rowKey={(l) => l.role}
          columns={[
            { key: 'role', label: 'Role', render: (l) => ROLE_CATALOG.find((r) => r.id === l.role)?.label ?? l.role },
            { key: 'limit', label: 'Single-sign limit', render: (l) => sar(l.limitSar) },
          ]}
          rows={APPROVAL_LIMITS}
        />
      </Card>
    </>
  );
}
