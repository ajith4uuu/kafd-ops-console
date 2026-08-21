import { useMemo, useState } from 'react';
import { Badge, Card, DataTable, num } from '../components/ui';
import { auditToCsv, filterAudit } from '../data/analytics';
import { AUDIT_LOG, type AuditEntry } from '../data/seed';

const ROLE_TONES: Record<AuditEntry['role'], 'green' | 'amber' | 'red' | 'peri'> = {
  ops_admin: 'peri',
  merchant: 'amber',
  leasing_agent: 'green',
  system: 'peri',
  security: 'red',
};

export function AuditPage() {
  const [pillar, setPillar] = useState<'' | AuditEntry['pillar']>('');
  const [role, setRole] = useState<'' | AuditEntry['role']>('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const rows = useMemo(
    () =>
      filterAudit(AUDIT_LOG, {
        pillar: pillar || undefined,
        role: role || undefined,
        query: query || undefined,
      }),
    [pillar, role, query],
  );
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));

  const exportCsv = () => {
    const blob = new Blob([auditToCsv(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kafd-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title={`${num(rows.length)} entries — 30-day retention window shown`}
      foot="Immutable trail: every privileged action across console, merchant portal, API and automations. PDPL exports themselves are audit-logged."
    >
      <div className="controls">
        <select
          aria-label="Filter by pillar"
          value={pillar}
          onChange={(e) => {
            setPillar(e.target.value as typeof pillar);
            setPage(0);
          }}
        >
          <option value="">All pillars</option>
          {(['dine', 'rafiq', 'go', 'living', 'ai', 'platform'] as const).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as typeof role);
            setPage(0);
          }}
        >
          <option value="">All roles</option>
          {(['ops_admin', 'merchant', 'leasing_agent', 'system', 'security'] as const).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Search audit log"
          placeholder="Search actor, action or entity…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <div className="spacer" />
        <button className="btn primary" onClick={exportCsv}>
          Export CSV ({num(rows.length)})
        </button>
      </div>

      <DataTable<AuditEntry>
        rowKey={(entry) => entry.id}
        columns={[
          { key: 'when', label: 'When', render: (entry) => `${entry.day.slice(5)} ${entry.time}` },
          { key: 'actor', label: 'Actor', render: (entry) => entry.actor },
          { key: 'role', label: 'Role', render: (entry) => <Badge tone={ROLE_TONES[entry.role]}>{entry.role}</Badge> },
          { key: 'pillar', label: 'Pillar', render: (entry) => <span className={`pillar-chip pillar-${entry.pillar === 'platform' ? 'ai' : entry.pillar}`}>{entry.pillar}</span> },
          { key: 'action', label: 'Action', render: (entry) => entry.action },
          { key: 'entity', label: 'Entity', render: (entry) => entry.entity },
          { key: 'channel', label: 'Channel', render: (entry) => entry.channel },
        ]}
        rows={pageRows}
      />

      <div className="controls" style={{ marginTop: 12 }}>
        <button className="btn" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
          ← Prev
        </button>
        <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Page {page + 1} / {pages}
        </span>
        <button className="btn" disabled={page >= pages - 1} onClick={() => setPage((prev) => prev + 1)}>
          Next →
        </button>
      </div>
    </Card>
  );
}
