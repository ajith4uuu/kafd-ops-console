import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num, sar } from '../components/ui';
import {
  SEED_EVENTS,
  SEED_GUESTS,
  SEED_POLICIES,
  SEED_REVIEWS,
  depositFor,
  eventIssues,
  eventRevenue,
  eventSeatsLeft,
  guestTier,
  policyIssues,
  reviewBreached,
  reviewSlaHours,
  type DepositPolicy,
  type DineEvent,
  type GuestProfile,
  type GuestReview,
} from '../data/dineops';

const STORE_KEY = 'kafd-guestcrm-v1';

interface CrmState {
  policies: DepositPolicy[];
  events: DineEvent[];
  reviews: GuestReview[];
}

function loadCrm(): CrmState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as CrmState;
  } catch {
    // fall through to seeds
  }
  return { policies: [...SEED_POLICIES], events: [...SEED_EVENTS], reviews: [...SEED_REVIEWS] };
}

const TIER_TONE = { vip: 'amber', regular: 'peri', new: 'green' } as const;

export function GuestsPage() {
  const [crm, setCrm] = useState<CrmState>(loadCrm);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(crm));
    } catch {
      // quota — session copy stays in memory
    }
  }, [crm]);

  const eventRev = crm.events.reduce((s, e) => s + eventRevenue(e), 0);
  const breaches = crm.reviews.filter(reviewBreached);
  const unreplied = crm.reviews.filter((r) => !r.replied);

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Guest profiles" value={num(SEED_GUESTS.length)} />
        <Kpi label="VIPs" value={String(SEED_GUESTS.filter((g) => guestTier(g) === 'vip').length)} />
        <Kpi label="Ticketed events" value={String(crm.events.length)} />
        <Kpi label="Prepaid event revenue" value={sar(eventRev)} />
        <Kpi label="Reviews awaiting reply" value={String(unreplied.length)} />
        <Kpi label="Reply-SLA breaches" value={String(breaches.length)} />
      </div>

      <Card
        title="Guest book — who's walking in tonight"
        foot="One profile across reservations, spend and visits. Allergy tags surface on the host stand and the kitchen ticket; date tags (birthdays, anniversaries) fire pre-shift prep notes."
        data-testid="guests-card"
      >
        <DataTable<GuestProfile>
          rowKey={(g) => g.id}
          columns={[
            { key: 'name', label: 'Guest', render: (g) => g.name },
            { key: 'tier', label: 'Tier', render: (g) => <Badge tone={TIER_TONE[guestTier(g)]}>{guestTier(g).toUpperCase()}</Badge> },
            { key: 'visits', label: 'Visits', render: (g) => String(g.visits) },
            { key: 'spend', label: 'Lifetime spend', render: (g) => sar(g.lifetimeSpendSar) },
            {
              key: 'allergies',
              label: 'Allergies',
              render: (g) =>
                g.allergies.length === 0 ? '—' : g.allergies.map((a) => <Badge key={a} tone="red">{a}</Badge>),
            },
            { key: 'tags', label: 'Notes', render: (g) => <span style={{ fontSize: 12, opacity: 0.75 }}>{g.tags.join(' · ')}</span> },
            { key: 'last', label: 'Last visit', render: (g) => g.lastVisit },
          ]}
          rows={[...SEED_GUESTS].sort((a, b) => b.lifetimeSpendSar - a.lifetimeSpendSar)}
        />
      </Card>

      <div className="grid cols-2">
        <Card
          title="Deposit & no-show policy per venue"
          foot="Deposits cut no-shows from the 15–20% industry norm to under 2%. Threshold parties pay per person, refundable inside the cancellation window; 24h suits casual rooms, 48h destination dining."
          data-testid="policies-card"
        >
          {crm.policies.map((p) => {
            const issues = policyIssues(p);
            return (
              <div key={p.venueId} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>{p.venue}</strong>
                  {issues.length > 0 ? (
                    <span title={issues.join('; ')} style={{ color: '#ff8da1', fontSize: 11 }}>✕ {issues[0]}</span>
                  ) : (
                    <Badge tone="green">party ≥ {p.partyThreshold} pays {sar(depositFor(p, p.partyThreshold))}</Badge>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                  <label>threshold
                    <input type="number" min={1} value={p.partyThreshold} style={{ width: 52, marginLeft: 6 }}
                      onChange={(e) => setCrm((prev) => ({ ...prev, policies: prev.policies.map((x) => (x.venueId === p.venueId ? { ...x, partyThreshold: Number(e.target.value) } : x)) }))} />
                  </label>
                  <label>SAR/person
                    <input type="number" value={p.perPersonSar} style={{ width: 64, marginLeft: 6 }}
                      onChange={(e) => setCrm((prev) => ({ ...prev, policies: prev.policies.map((x) => (x.venueId === p.venueId ? { ...x, perPersonSar: Number(e.target.value) } : x)) }))} />
                  </label>
                  <label>cancel window
                    <select value={p.cancelWindowHours} style={{ marginLeft: 6 }}
                      onChange={(e) => setCrm((prev) => ({ ...prev, policies: prev.policies.map((x) => (x.venueId === p.venueId ? { ...x, cancelWindowHours: Number(e.target.value) } : x)) }))}>
                      <option value={24}>24h</option>
                      <option value={48}>48h</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </Card>

        <Card
          title="Ticketed experiences"
          foot="Prepaid experiences run ~50% higher spend per guest than standard covers, and prepayment makes the revenue no-show-proof."
          data-testid="events-card"
        >
          {crm.events.map((e) => {
            const pct = Math.round((e.sold / e.seats) * 100);
            const issues = eventIssues(e);
            return (
              <div key={e.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13.5 }}>{e.title}</strong>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={e.state === 'on_sale' ? 'green' : e.state === 'sold_out' ? 'amber' : e.state === 'draft' ? 'peri' : 'red'}>
                      {e.state.replace('_', ' ')}
                    </Badge>
                    {e.state === 'draft' && issues.length === 0 && (
                      <button className="btn primary" onClick={() => setCrm((prev) => ({ ...prev, events: prev.events.map((x) => (x.id === e.id ? { ...x, state: 'on_sale' } : x)) }))}>
                        Put on sale
                      </button>
                    )}
                    {e.state === 'on_sale' && (
                      <button className="btn" onClick={() => setCrm((prev) => ({ ...prev, events: prev.events.map((x) => (x.id === e.id ? { ...x, state: 'closed' } : x)) }))}>
                        Close
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                  {e.venue} · {e.date} · {sar(e.priceSar)}/seat · {eventSeatsLeft(e)} left · {sar(eventRevenue(e))} prepaid
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: pct === 100 ? '#e8b463' : '#7ecb93' }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card
        title="Review desk"
        foot="Negative reviews (≤3★) carry a 24-hour reply SLA, everything else 72 hours. A breach row stays red until answered — reputation is a service, not a scoreboard."
        data-testid="reviews-card"
      >
        <DataTable<GuestReview>
          rowKey={(r) => r.id}
          columns={[
            { key: 'venue', label: 'Venue', render: (r) => r.venue },
            { key: 'rating', label: 'Rating', render: (r) => <Badge tone={r.rating >= 4 ? 'green' : r.rating === 3 ? 'amber' : 'red'}>{'★'.repeat(r.rating)}</Badge> },
            { key: 'excerpt', label: 'Review', render: (r) => <span style={{ fontSize: 12.5 }}>{r.excerpt}</span> },
            { key: 'channel', label: 'Channel', render: (r) => r.channel },
            {
              key: 'sla',
              label: 'Age vs SLA',
              render: (r) => (
                <span style={{ color: reviewBreached(r) ? '#ff8da1' : undefined, fontSize: 12.5 }}>
                  {r.ageHours}h / {reviewSlaHours(r)}h{reviewBreached(r) ? ' — BREACH' : ''}
                </span>
              ),
            },
            {
              key: 'action',
              label: '',
              render: (r) =>
                r.replied ? (
                  <Badge tone="green">replied</Badge>
                ) : (
                  <button className="btn primary" onClick={() => setCrm((prev) => ({ ...prev, reviews: prev.reviews.map((x) => (x.id === r.id ? { ...x, replied: true } : x)) }))}>
                    Reply
                  </button>
                ),
            },
          ]}
          rows={crm.reviews}
        />
      </Card>
    </>
  );
}
