import { useEffect, useState } from 'react';
import { RangePicker } from './components/ui';
import { openIncidents, type Range } from './data/analytics';
import { AiPage } from './pages/AiPage';
import { AuditPage } from './pages/AuditPage';
import { BookingsPage } from './pages/BookingsPage';
import { CompliancePage } from './pages/CompliancePage';
import { GrowthPage } from './pages/GrowthPage';
import { DinePage } from './pages/DinePage';
import { GoPage } from './pages/GoPage';
import { LivingPage } from './pages/LivingPage';
import { EstatePage } from './pages/EstatePage';
import { HrPage } from './pages/HrPage';
import { AdminsPage } from './pages/AdminsPage';
import { LifecyclePage } from './pages/LifecyclePage';
import { FinanceOpsPage } from './pages/FinanceOpsPage';
import { OverviewPage } from './pages/OverviewPage';
import { RafiqPage } from './pages/RafiqPage';
import { VenuesPage } from './pages/VenuesPage';

type PageId =
  | 'overview' | 'growth' | 'dine' | 'rafiq' | 'go' | 'living'
  | 'bookings' | 'ai' | 'audit' | 'compliance' | 'venues' | 'estate' | 'hr' | 'admins' | 'lifecycle' | 'financeops';

type WorkspaceId = 'rafiq-ops' | 'property' | 'hospitality' | 'estate-admin' | 'control';

/**
 * One unified platform, three team consoles: mobility, property, and
 * tables-and-delivery each get their own scoped workspace, sharing the
 * Command Center pulse and the audit trail.
 */
const WORKSPACES: Record<WorkspaceId, { label: string; sub: string; home: PageId; pages: PageId[] }> = {
  'rafiq-ops': {
    label: 'Rafiq Mobility',
    sub: 'Mobility Ops Team',
    home: 'rafiq',
    pages: ['rafiq', 'growth', 'overview', 'audit'],
  },
  property: {
    label: 'Property',
    sub: 'Property Management Team',
    home: 'living',
    pages: ['living', 'compliance', 'bookings', 'overview', 'audit'],
  },
  control: {
    label: 'Control Panel',
    sub: 'Platform Governance',
    home: 'admins',
    pages: ['admins', 'lifecycle', 'financeops', 'audit'],
  },
  'estate-admin': {
    label: 'Estate Admin',
    sub: 'Super Admin — URWA Core',
    home: 'estate',
    pages: ['estate', 'hr', 'overview', 'audit'],
  },
  hospitality: {
    label: 'Tables & Delivery',
    sub: 'Hospitality Ops Team',
    home: 'dine',
    pages: ['dine', 'venues', 'go', 'bookings', 'ai', 'overview', 'audit'],
  },
};

const PAGE_META: Record<PageId, { icon: string; label: string }> = {
  overview: { icon: '◉', label: 'Command Center' },
  growth: { icon: '📈', label: 'Growth & Loyalty' },
  dine: { icon: '🍽', label: 'Dine' },
  rafiq: { icon: '🚗', label: 'Rafiq' },
  go: { icon: '🛵', label: 'Go Delivery' },
  living: { icon: '🏢', label: 'Living+' },
  bookings: { icon: '🗓', label: 'Bookings & Events' },
  ai: { icon: '✦', label: 'Concierge AI' },
  audit: { icon: '☰', label: 'Audit Log' },
  compliance: { icon: '⚖', label: 'Compliance & Ejar' },
  venues: { icon: '🕐', label: 'Venues & Hours' },
  estate: { icon: '🏛', label: 'Estate Ops' },
  hr: { icon: '👥', label: 'HR & Payroll' },
  admins: { icon: '🛡', label: 'Admins & Roles' },
  lifecycle: { icon: '🔄', label: 'Access Lifecycle' },
  financeops: { icon: '🏦', label: 'Finance Controls' },
};

const TITLES: Record<PageId, [string, string]> = {
  overview: ['Command Center', 'District-wide pulse across all five pillars'],
  growth: ['Growth & Loyalty', 'Actives, retention cohorts, KAFD Rewards economics and offer performance'],
  bookings: ['Bookings & Events', 'Rooms, courts, utilization and event programming'],
  dine: ['Dine Operations', 'Reservations, covers, no-shows, waitlist and pacing'],
  rafiq: ['Rafiq Mobility', 'Rides, pooling, safety, unit economics and the CO₂ program'],
  go: ['Go Delivery', 'Orders, desk delivery SLAs, merchants and couriers'],
  living: ['Living+ Property', 'Occupancy, rent collection, work orders and leasing'],
  ai: ['Concierge AI', 'Sessions, tool accuracy, language parity and unit economics'],
  audit: ['Audit Log', 'Every privileged action across console, portal, API and automations'],
  compliance: ['Compliance & Ejar', 'Ejar registrations, deposit caps, the rent freeze, ZATCA e-invoices and licensed short stays'],
  venues: ['Venues & Hours', 'Real published trading hours — split services, late closes and 24-hour days'],
  estate: ['Estate Ops', 'URWA-core operations: services volume, SLA credits, gate security and partner settlement'],
  hr: ['HR & Payroll', 'Attendance, WPS payroll runs and the recruitment pipeline across the estate teams'],
  admins: ['Admins & Roles', 'Division admins, the role catalog with least-privilege permissions, and segregation of duties'],
  lifecycle: ['Access Lifecycle', 'Joiner / mover / leaver requests, offboarding checklists and the quarterly access review'],
  financeops: ['Finance Controls', 'Dual-control approval queue, maker-checker enforcement and single-sign limits'],
};

function initialWorkspace(): WorkspaceId {
  const fromHash = location.hash.match(/ws=([a-z-]+)/)?.[1];
  const stored = localStorage.getItem('kafd-ws');
  const candidate = (fromHash ?? stored) as WorkspaceId | null;
  return candidate && candidate in WORKSPACES ? candidate : 'rafiq-ops';
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceId>(initialWorkspace);
  const [page, setPage] = useState<PageId>(() => WORKSPACES[initialWorkspace()].home);
  const [range, setRange] = useState<Range>(30);
  const alerts = openIncidents().length;
  const ws = WORKSPACES[workspace];

  useEffect(() => {
    localStorage.setItem('kafd-ws', workspace);
    location.hash = `ws=${workspace}`;
  }, [workspace]);

  const switchWorkspace = (next: WorkspaceId) => {
    setWorkspace(next);
    setPage(WORKSPACES[next].home);
  };

  return (
    <>
      <nav className="sidebar">
        <h1 className="brand">KΛFD</h1>
        <p className="brand-sub">{ws.sub}</p>
        <div className="ws-switch" role="tablist" aria-label="Console workspace">
          {(Object.keys(WORKSPACES) as WorkspaceId[]).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={workspace === id}
              className={workspace === id ? 'active' : ''}
              onClick={() => switchWorkspace(id)}
            >
              {WORKSPACES[id].label}
            </button>
          ))}
        </div>
        {ws.pages.map((id) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
            aria-current={page === id}
          >
            <span aria-hidden>{PAGE_META[id].icon}</span>
            {PAGE_META[id].label}
            {id === 'overview' && alerts > 0 ? <span className="dot">{alerts}</span> : null}
          </button>
        ))}
        <div className="sidebar-footer">
          One platform · three team consoles
          <br />
          Seeded demo data · 90 days
        </div>
      </nav>

      <main className="main">
        <div className="page-head">
          <h2 className="page-title">{TITLES[page][0]}</h2>
          <div className="spacer" />
          {page !== 'audit' && page !== 'venues' && page !== 'hr' && page !== 'admins' && page !== 'lifecycle' && page !== 'financeops' ? <RangePicker value={range} onChange={setRange} /> : null}
          <p className="page-sub">{TITLES[page][1]}</p>
        </div>

        {page === 'overview' ? <OverviewPage range={range} /> : null}
        {page === 'growth' ? <GrowthPage range={range} /> : null}
        {page === 'bookings' ? <BookingsPage range={range} /> : null}
        {page === 'dine' ? <DinePage range={range} /> : null}
        {page === 'rafiq' ? <RafiqPage range={range} /> : null}
        {page === 'go' ? <GoPage range={range} /> : null}
        {page === 'living' ? <LivingPage /> : null}
        {page === 'ai' ? <AiPage range={range} /> : null}
        {page === 'audit' ? <AuditPage /> : null}
        {page === 'compliance' ? <CompliancePage range={range} /> : null}
        {page === 'venues' ? <VenuesPage /> : null}
        {page === 'estate' ? <EstatePage range={range} /> : null}
        {page === 'hr' ? <HrPage /> : null}
        {page === 'admins' ? <AdminsPage /> : null}
        {page === 'lifecycle' ? <LifecyclePage /> : null}
        {page === 'financeops' ? <FinanceOpsPage /> : null}
      </main>
    </>
  );
}
