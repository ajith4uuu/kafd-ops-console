import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num } from '../components/ui';
import { TODAY_KEY } from '../data/seed';
import {
  SEED_DIRECTORY,
  SEED_HERO,
  SEED_OFFERS,
  offerEffectiveState,
  offerIssues,
  type DirectoryEntry,
  type HeroContent,
  type Offer,
  type OfferState,
} from '../data/portfolio';

const STORE_KEY = 'kafd-cms-v1';

interface CmsState {
  offers: Offer[];
  directory: DirectoryEntry[];
  hero: HeroContent;
}

function loadCms(): CmsState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as CmsState;
  } catch {
    // fall through to seeds
  }
  return { offers: [...SEED_OFFERS], directory: [...SEED_DIRECTORY], hero: { ...SEED_HERO } };
}

const STATE_TONE: Record<OfferState, 'green' | 'amber' | 'peri' | 'red'> = {
  live: 'green',
  scheduled: 'peri',
  draft: 'amber',
  paused: 'amber',
  expired: 'red',
};

export function CmsPage() {
  const [cms, setCms] = useState<CmsState>(loadCms);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(cms));
    } catch {
      // quota — session copy stays in memory
    }
  }, [cms]);

  const patchOffer = (id: string, updater: (o: Offer) => Offer) =>
    setCms((prev) => ({ ...prev, offers: prev.offers.map((o) => (o.id === id ? updater(o) : o)) }));

  const newOffer = () => {
    const id = `off-new-${Date.now()}`;
    setCms((prev) => ({
      ...prev,
      offers: [
        { id, title: 'New offer', pillar: 'dine', kind: 'percent', value: 10, validFrom: TODAY_KEY, validTo: TODAY_KEY, audience: 'everyone', state: 'draft', redemptions: 0 },
        ...prev.offers,
      ],
    }));
  };

  const liveCount = cms.offers.filter((o) => offerEffectiveState(o, TODAY_KEY) === 'live').length;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Offers live now" value={String(liveCount)} />
        <Kpi label="Scheduled" value={String(cms.offers.filter((o) => offerEffectiveState(o, TODAY_KEY) === 'scheduled').length)} />
        <Kpi label="Total redemptions" value={num(cms.offers.reduce((s, o) => s + o.redemptions, 0))} />
        <Kpi label="Directory entries" value={String(cms.directory.length)} />
        <Kpi label="Hidden entries" value={String(cms.directory.filter((d) => !d.visible).length)} />
        <Kpi label="Featured" value={String(cms.directory.filter((d) => d.featured).length)} />
      </div>

      <Card
        title="Offers & promotions"
        foot="Publish makes a valid offer live inside its window; scheduling is just a future start date. Percent offers cap at 50% — deeper discounts need a super-admin exception."
        data-testid="offers-card"
      >
        <div style={{ marginBottom: 10 }}>
          <button className="btn primary" onClick={newOffer}>+ New offer</button>
        </div>
        <DataTable<Offer>
          rowKey={(o) => o.id}
          columns={[
            {
              key: 'title',
              label: 'Offer',
              render: (o) => (
                <input
                  value={o.title}
                  onChange={(e) => patchOffer(o.id, (x) => ({ ...x, title: e.target.value }))}
                  style={{ minWidth: 220 }}
                />
              ),
            },
            {
              key: 'pillar',
              label: 'Pillar',
              render: (o) => (
                <select value={o.pillar} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, pillar: e.target.value as Offer['pillar'] }))}>
                  {['dine', 'rafiq', 'go', 'living', 'estate'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ),
            },
            {
              key: 'value',
              label: 'Value',
              render: (o) => (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <input type="number" value={o.value} style={{ width: 64 }} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, value: Number(e.target.value) }))} />
                  <select value={o.kind} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, kind: e.target.value as Offer['kind'] }))}>
                    <option value="percent">%</option>
                    <option value="amount">SAR</option>
                  </select>
                </span>
              ),
            },
            {
              key: 'window',
              label: 'Window',
              render: (o) => (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input type="date" value={o.validFrom} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, validFrom: e.target.value }))} />
                  <input type="date" value={o.validTo} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, validTo: e.target.value }))} />
                </span>
              ),
            },
            {
              key: 'audience',
              label: 'Audience',
              render: (o) => (
                <select value={o.audience} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, audience: e.target.value as Offer['audience'] }))}>
                  {['everyone', 'residents', 'workers', 'nafath_verified'].map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                </select>
              ),
            },
            { key: 'red', label: 'Redeemed', render: (o) => num(o.redemptions) },
            {
              key: 'state',
              label: 'State',
              render: (o) => {
                const issues = offerIssues(o);
                const eff = offerEffectiveState(o, TODAY_KEY);
                return (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={STATE_TONE[eff]}>{eff}</Badge>
                    {issues.length > 0 ? (
                      <span title={issues.join('; ')} style={{ color: '#ff8da1', fontSize: 11 }}>✕ {issues.length} issue{issues.length > 1 ? 's' : ''}</span>
                    ) : eff === 'draft' || eff === 'paused' ? (
                      <button className="btn primary" onClick={() => patchOffer(o.id, (x) => ({ ...x, state: 'live' }))}>Publish</button>
                    ) : eff === 'live' || eff === 'scheduled' ? (
                      <button className="btn" onClick={() => patchOffer(o.id, (x) => ({ ...x, state: 'paused' }))}>Pause</button>
                    ) : null}
                  </span>
                );
              },
            },
          ]}
          rows={cms.offers}
        />
      </Card>

      <div className="grid cols-2">
        <Card
          title="Web directory control"
          foot="Visibility gates whether an entry renders in Discover; featuring pins it to the top shelf. Hidden entries keep their data — nothing is deleted from the audit trail."
          data-testid="directory-card"
        >
          <DataTable<DirectoryEntry>
            rowKey={(d) => d.id}
            columns={[
              { key: 'name', label: 'Entry', render: (d) => d.name },
              { key: 'category', label: 'Category', render: (d) => d.category },
              { key: 'tower', label: 'Location', render: (d) => d.tower },
              {
                key: 'visible',
                label: 'Visible',
                render: (d) => (
                  <button
                    className="btn"
                    onClick={() =>
                      setCms((prev) => ({
                        ...prev,
                        directory: prev.directory.map((x) =>
                          x.id === d.id ? { ...x, visible: !x.visible, featured: x.visible ? false : x.featured } : x,
                        ),
                      }))
                    }
                  >
                    {d.visible ? 'Hide' : 'Show'}
                  </button>
                ),
              },
              {
                key: 'featured',
                label: 'Featured',
                render: (d) => (
                  <button
                    className={d.featured ? 'btn primary' : 'btn'}
                    disabled={!d.visible}
                    onClick={() =>
                      setCms((prev) => ({
                        ...prev,
                        directory: prev.directory.map((x) => (x.id === d.id ? { ...x, featured: !x.featured } : x)),
                      }))
                    }
                  >
                    {d.featured ? '★ Featured' : '☆ Feature'}
                  </button>
                ),
              },
              {
                key: 'state',
                label: '',
                render: (d) => <Badge tone={d.visible ? 'green' : 'red'}>{d.visible ? 'published' : 'hidden'}</Badge>,
              },
            ]}
            rows={cms.directory}
          />
        </Card>

        <Card
          title="App hero content"
          foot="Edits here drive the superapp home hero and the landing page headline — one source of truth for district messaging."
          data-testid="hero-card"
        >
          <label className="fld" style={{ display: 'block', marginBottom: 8 }}>Headline
            <input value={cms.hero.headline} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, headline: e.target.value } }))} />
          </label>
          <label className="fld" style={{ display: 'block', marginBottom: 8 }}>Subline
            <textarea rows={2} value={cms.hero.subline} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, subline: e.target.value } }))} />
          </label>
          <label className="fld" style={{ display: 'block', marginBottom: 12 }}>CTA label
            <input value={cms.hero.ctaLabel} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, ctaLabel: e.target.value } }))} />
          </label>
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '22px 18px', background: 'linear-gradient(150deg, #1d2740, #28334a)' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#fff', marginBottom: 6 }}>{cms.hero.headline}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{cms.hero.subline}</div>
            <span style={{ display: 'inline-block', background: '#e8b463', color: '#1d2740', fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '8px 16px', letterSpacing: 1 }}>
              {cms.hero.ctaLabel.toUpperCase()}
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
