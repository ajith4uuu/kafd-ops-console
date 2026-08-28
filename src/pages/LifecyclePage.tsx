import { useState } from 'react';
import { Badge, Card, DataTable, Kpi } from '../components/ui';
import { controlKpis } from '../data/analytics';
import {
  ACCESS_REQUESTS,
  ACCESS_REVIEW,
  OFFBOARDING_CASES,
  ROLE_CATALOG,
  type AccessRequest,
} from '../data/seed';

const KIND_META: Record<AccessRequest['kind'], { label: string; tone: 'green' | 'peri' | 'amber' }> = {
  joiner: { label: 'Joiner', tone: 'green' },
  mover: { label: 'Mover', tone: 'peri' },
  leaver: { label: 'Leaver', tone: 'amber' },
};

/** req-04 models the SoD-blocked promotion — approval stays disabled until maker rights drop. */
const SOD_BLOCKED_IDS = new Set(['req-04']);

export function LifecyclePage() {
  const kpis = controlKpis();
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});

  const decide = (id: string, decision: 'approved' | 'rejected') =>
    setDecisions((prev) => ({ ...prev, [id]: decision }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Open requests" value={String(ACCESS_REQUESTS.filter((r) => !decisions[r.id]).length)} />
        <Kpi label="Joiners this week" value={String(ACCESS_REQUESTS.filter((r) => r.kind === 'joiner').length)} />
        <Kpi label="Offboarding cases" value={String(OFFBOARDING_CASES.length)} />
        <Kpi label="Q3 review progress" value={`${kpis.reviewPct}%`} />
        <Kpi label="Access revoked in review" value={String(kpis.reviewRevoked)} />
        <Kpi label="Stale accounts flagged" value={String(kpis.stale)} />
      </div>

      <Card
        title="Access requests — approve as Layla Al-Rashid (Super Admin)"
        foot="Requester and approver must differ (four-eyes). A mover keeps old rights only until the new grant lands — never both. SoD-conflicting requests stay blocked until the conflicting right is dropped."
        data-testid="requests-card"
      >
        <DataTable<AccessRequest>
          rowKey={(r) => r.id}
          columns={[
            { key: 'kind', label: 'Type', render: (r) => <Badge tone={KIND_META[r.kind].tone}>{KIND_META[r.kind].label}</Badge> },
            { key: 'person', label: 'Person', render: (r) => r.person },
            { key: 'division', label: 'Division', render: (r) => r.division },
            { key: 'role', label: 'Role', render: (r) => ROLE_CATALOG.find((x) => x.id === r.role)?.label ?? r.role },
            { key: 'by', label: 'Requested by', render: (r) => r.requestedBy },
            { key: 'age', label: 'Age', render: (r) => `${r.ageDays}d` },
            { key: 'note', label: 'Note', render: (r) => <span style={{ fontSize: 12 }}>{r.note}</span> },
            {
              key: 'actions',
              label: 'Decision',
              render: (r) => {
                const decided = decisions[r.id];
                if (decided) {
                  return <Badge tone={decided === 'approved' ? 'green' : 'red'}>{decided}</Badge>;
                }
                if (SOD_BLOCKED_IDS.has(r.id)) {
                  return <Badge tone="red">SoD blocked</Badge>;
                }
                return (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <button className="btn primary" onClick={() => decide(r.id, 'approved')}>Approve</button>
                    <button className="btn" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                  </span>
                );
              },
            },
          ]}
          rows={ACCESS_REQUESTS}
        />
      </Card>

      <div className="grid cols-2">
        <Card
          title="Offboarding checklists"
          foot="Session revocation and role removal fire the moment a leaver case opens; payroll, exports and the PDPL mailbox archive close within the week."
          data-testid="offboarding-card"
        >
          {OFFBOARDING_CASES.map((c) => {
            const done = c.steps.filter((s) => s.done).length;
            return (
              <div key={c.person} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>{c.person}</strong>
                  <Badge tone={done === c.steps.length ? 'green' : 'amber'}>{done}/{c.steps.length} complete</Badge>
                </div>
                {c.steps.map((s) => (
                  <div key={s.step} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2px 0', color: s.done ? '#7ecb93' : 'rgba(255,255,255,0.55)' }}>
                    <span>{s.done ? '✓' : '○'}</span>
                    <span>{s.step}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </Card>

        <Card
          title="Q3-2026 access recertification"
          foot="Every division re-attests each admin's rights quarterly; unreviewed grants auto-suspend at campaign close. Two grants were revoked this quarter."
          data-testid="review-card"
        >
          {ACCESS_REVIEW.map((r) => {
            const pct = Math.round((r.reviewed / r.total) * 100);
            return (
              <div key={r.division} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ textTransform: 'capitalize' }}>{r.division}</span>
                  <span>
                    {r.reviewed}/{r.total} reviewed{r.revoked > 0 ? ` · ${r.revoked} revoked` : ''}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: pct === 100 ? '#7ecb93' : '#e8b463' }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
