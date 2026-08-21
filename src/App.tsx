import { useState } from 'react';
import { RangePicker } from './components/ui';
import { openIncidents, type Range } from './data/analytics';
import { AiPage } from './pages/AiPage';
import { AuditPage } from './pages/AuditPage';
import { BookingsPage } from './pages/BookingsPage';
import { GrowthPage } from './pages/GrowthPage';
import { DinePage } from './pages/DinePage';
import { GoPage } from './pages/GoPage';
import { LivingPage } from './pages/LivingPage';
import { OverviewPage } from './pages/OverviewPage';
import { RafiqPage } from './pages/RafiqPage';

type PageId = 'overview' | 'growth' | 'dine' | 'rafiq' | 'go' | 'living' | 'bookings' | 'ai' | 'audit';

const PAGES: { id: PageId; icon: string; label: string }[] = [
  { id: 'overview', icon: '◉', label: 'Command Center' },
  { id: 'growth', icon: '📈', label: 'Growth & Loyalty' },
  { id: 'dine', icon: '🍽', label: 'Dine' },
  { id: 'rafiq', icon: '🚗', label: 'Rafiq' },
  { id: 'go', icon: '🛵', label: 'Go Delivery' },
  { id: 'living', icon: '🏢', label: 'Living+' },
  { id: 'bookings', icon: '🗓', label: 'Bookings & Events' },
  { id: 'ai', icon: '✦', label: 'Concierge AI' },
  { id: 'audit', icon: '☰', label: 'Audit Log' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('overview');
  const [range, setRange] = useState<Range>(30);
  const alerts = openIncidents().length;

  const titles: Record<PageId, [string, string]> = {
    overview: ['Command Center', 'District-wide pulse across all five pillars'],
    growth: ['Growth & Loyalty', 'Actives, retention cohorts, KAFD Rewards economics and offer performance'],
    bookings: ['Bookings & Events', 'Rooms, courts, utilization and event programming'],
    dine: ['Dine Operations', 'Reservations, covers, no-shows, waitlist and pacing'],
    rafiq: ['Rafiq Mobility', 'Rides, pooling, safety and the CO₂ program'],
    go: ['Go Delivery', 'Orders, desk delivery SLAs, merchants and couriers'],
    living: ['Living+ Property', 'Occupancy, rent collection, work orders and leasing'],
    ai: ['Concierge AI', 'Sessions, tool accuracy, language parity and unit economics'],
    audit: ['Audit Log', 'Every privileged action across console, portal, API and automations'],
  };

  return (
    <>
      <nav className="sidebar">
        <h1 className="brand">KΛFD</h1>
        <p className="brand-sub">Ops Console</p>
        {PAGES.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
            aria-current={page === item.id}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
            {item.id === 'overview' && alerts > 0 ? <span className="dot">{alerts}</span> : null}
          </button>
        ))}
        <div className="sidebar-footer">
          Seeded demo data · 90 days
          <br />
          services/* + ClickHouse in prod
        </div>
      </nav>

      <main className="main">
        <div className="page-head">
          <h2 className="page-title">{titles[page][0]}</h2>
          <div className="spacer" />
          {page !== 'audit' ? <RangePicker value={range} onChange={setRange} /> : null}
          <p className="page-sub">{titles[page][1]}</p>
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
      </main>
    </>
  );
}
