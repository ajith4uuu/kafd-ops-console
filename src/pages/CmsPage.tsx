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

const AUDIENCE_LABEL: Record<Offer['audience'], string> = {
  everyone: 'Everyone',
  residents: 'Residents',
  workers: 'Workers',
  nafath_verified: 'Nafath-verified',
};

function offerValueLabel(o: Offer): string {
  return o.kind === 'percent' ? `${o.value}% off` : `SAR ${o.value} off`;
}

export function CmsPage() {
  const [cms, setCms] = useState<CmsState>(loadCms);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setEditingId(id);
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
        foot="Each row reads as a sentence; Edit opens the fields for just that offer. Publish makes a valid offer live inside its window; scheduling is just a future start date. Percent offers cap at 50% — deeper discounts need a super-admin exception."
        data-testid="offers-card"
      >
        <div style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={newOffer}>+ New offer</button>
        </div>
        {cms.offers.map((o) => {
          const issues = offerIssues(o);
          const eff = offerEffectiveState(o, TODAY_KEY);
          const editing = editingId === o.id;
          return (
            <div key={o.id} className={`vrow ${editing ? 'editing' : ''}`}>
              <span className="vtitle">{o.title}</span>
              <Badge tone="peri">{o.pillar}</Badge>
              <span className="vmeta"><strong style={{ color: 'var(--amber)' }}>{offerValueLabel(o)}</strong></span>
              <span className="vmeta">{o.validFrom} → {o.validTo}</span>
              <span className="vmeta">{AUDIENCE_LABEL[o.audience]}</span>
              <span className="vmeta">{num(o.redemptions)} redeemed</span>
              <span className="vspacer" />
              <Badge tone={STATE_TONE[eff]}>{eff}</Badge>
              {issues.length > 0 ? (
                <span title={issues.join('; ')} style={{ color: 'var(--red)', fontSize: 12 }}>✕ {issues.length} issue{issues.length > 1 ? 's' : ''}</span>
              ) : eff === 'draft' || eff === 'paused' ? (
                <button className="btn primary" onClick={() => patchOffer(o.id, (x) => ({ ...x, state: 'live' }))}>Publish</button>
              ) : eff === 'live' || eff === 'scheduled' ? (
                <button className="btn" onClick={() => patchOffer(o.id, (x) => ({ ...x, state: 'paused' }))}>Pause</button>
              ) : null}
              <button className="btn ghost" onClick={() => setEditingId(editing ? null : o.id)}>
                {editing ? 'Done' : 'Edit'}
              </button>

              {editing && (
                <div className="editpanel">
                  <label className="fld wide">Title
                    <input value={o.title} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, title: e.target.value }))} />
                  </label>
                  <label className="fld">Pillar
                    <select value={o.pillar} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, pillar: e.target.value as Offer['pillar'] }))}>
                      {['dine', 'rafiq', 'go', 'living', 'estate'].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="fld">Value
                    <input type="number" value={o.value} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, value: Number(e.target.value) }))} />
                  </label>
                  <label className="fld">Unit
                    <select value={o.kind} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, kind: e.target.value as Offer['kind'] }))}>
                      <option value="percent">% off</option>
                      <option value="amount">SAR off</option>
                    </select>
                  </label>
                  <label className="fld">Audience
                    <select value={o.audience} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, audience: e.target.value as Offer['audience'] }))}>
                      {(Object.keys(AUDIENCE_LABEL) as Offer['audience'][]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
                    </select>
                  </label>
                  <label className="fld">Starts
                    <input type="date" value={o.validFrom} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, validFrom: e.target.value }))} />
                  </label>
                  <label className="fld">Ends
                    <input type="date" value={o.validTo} onChange={(e) => patchOffer(o.id, (x) => ({ ...x, validTo: e.target.value }))} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
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
                key: 'state',
                label: 'Status',
                render: (d) => <Badge tone={d.visible ? 'green' : 'red'}>{d.visible ? 'published' : 'hidden'}</Badge>,
              },
              {
                key: 'visible',
                label: '',
                render: (d) => (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
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
                  </span>
                ),
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
            <label className="fld">Headline
              <input value={cms.hero.headline} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, headline: e.target.value } }))} />
            </label>
            <label className="fld">Subline
              <textarea rows={2} value={cms.hero.subline} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, subline: e.target.value } }))} />
            </label>
            <label className="fld">Button label
              <input value={cms.hero.ctaLabel} onChange={(e) => setCms((prev) => ({ ...prev, hero: { ...prev.hero, ctaLabel: e.target.value } }))} />
            </label>
          </div>
          <p className="side-label" style={{ margin: '0 0 8px' }}>Live preview</p>
          <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, padding: '24px 20px', background: 'linear-gradient(150deg, #1b2334, #222c40)' }}>
            <div style={{ fontFamily: 'Jost, sans-serif', fontWeight: 400, fontSize: 25, letterSpacing: 0.5, color: '#fff', marginBottom: 6 }}>{cms.hero.headline}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>{cms.hero.subline}</div>
            <span style={{ display: 'inline-block', background: 'var(--teal)', color: 'var(--ink)', fontWeight: 600, fontSize: 12, borderRadius: 99, padding: '9px 18px', letterSpacing: 1 }}>
              {cms.hero.ctaLabel.toUpperCase()}
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
