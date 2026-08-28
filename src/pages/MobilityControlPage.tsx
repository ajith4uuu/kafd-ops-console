import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num, sar } from '../components/ui';
import { TODAY_KEY } from '../data/seed';
import {
  INCIDENT_SLA_HOURS,
  SEED_CLASSES,
  SEED_INCIDENTS,
  SEED_PROMOS,
  SEED_SHUTTLES,
  SEED_ZONES,
  SURGE_CAP,
  fareEstimate,
  incidentBreached,
  pricingIssues,
  promoEffectiveState,
  promoIssues,
  type PromoState,
  type RafiqIncident,
  type RideClassPricing,
  type RidePromo,
  type ShuttleRoute,
  type SurgeZone,
} from '../data/rafiqops';

const STORE_KEY = 'kafd-mobility-v1';

interface MobilityState {
  classes: RideClassPricing[];
  zones: SurgeZone[];
  shuttles: ShuttleRoute[];
  promos: RidePromo[];
  incidents: RafiqIncident[];
}

function loadMobility(): MobilityState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MobilityState;
  } catch {
    // fall through to seeds
  }
  return {
    classes: [...SEED_CLASSES],
    zones: [...SEED_ZONES],
    shuttles: [...SEED_SHUTTLES],
    promos: [...SEED_PROMOS],
    incidents: [...SEED_INCIDENTS],
  };
}

const PROMO_TONE: Record<PromoState, 'green' | 'amber' | 'peri' | 'red'> = {
  live: 'green',
  scheduled: 'peri',
  draft: 'amber',
  paused: 'amber',
  expired: 'red',
  exhausted: 'red',
};

/** Reference trip used by the fare preview column: KAFD → DQ, 12 km / 18 min. */
const REF_KM = 12;
const REF_MIN = 18;

export function MobilityControlPage() {
  const [state, setState] = useState<MobilityState>(loadMobility);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // quota — session copy stays in memory
    }
  }, [state]);

  const coreZone = state.zones[0];
  const openIncidents = state.incidents.filter((i) => i.status !== 'resolved');
  const breaches = state.incidents.filter(incidentBreached);

  const patchClass = (id: string, updater: (c: RideClassPricing) => RideClassPricing) =>
    setState((prev) => ({ ...prev, classes: prev.classes.map((c) => (c.id === id ? updater(c) : c)) }));

  const patchPromo = (id: string, updater: (p: RidePromo) => RidePromo) =>
    setState((prev) => ({ ...prev, promos: prev.promos.map((p) => (p.id === id ? updater(p) : p)) }));

  const newPromo = () => {
    setState((prev) => ({
      ...prev,
      promos: [
        { id: `pr-new-${Date.now()}`, code: 'NEWCODE', kind: 'percent', value: 10, perRideCapSar: 10, budgetSar: 5000, spentSar: 0, validFrom: TODAY_KEY, validTo: TODAY_KEY, audience: 'everyone', state: 'draft', redemptions: 0 },
        ...prev.promos,
      ],
    }));
  };

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Ride tiers live" value={`${state.classes.filter((c) => c.active).length}/${state.classes.length}`} />
        <Kpi label="Peak-zone surge" value={`${coreZone.multiplier.toFixed(1)}× (cap ${SURGE_CAP.toFixed(1)}×)`} />
        <Kpi label="Shuttle routes on" value={`${state.shuttles.filter((s) => s.active).length}/${state.shuttles.length}`} />
        <Kpi label="Promos live" value={String(state.promos.filter((p) => promoEffectiveState(p, TODAY_KEY) === 'live').length)} />
        <Kpi label="Open incidents" value={String(openIncidents.length)} />
        <Kpi label="SLA breaches" value={String(breaches.length)} />
      </div>

      <Card
        title="Tier pricing — no-code fare control"
        foot={`Preview fare is the reference trip (12 km / 18 min) at the Financial-core multiplier. Invalid pricing never reaches riders — the row flags it and dispatch keeps the last good table.`}
        data-testid="pricing-card"
      >
        <DataTable<RideClassPricing>
          rowKey={(c) => c.id}
          columns={[
            { key: 'label', label: 'Tier', render: (c) => c.label },
            {
              key: 'base',
              label: 'Base',
              render: (c) => <input type="number" step="0.5" value={c.baseSar} style={{ width: 64 }} onChange={(e) => patchClass(c.id, (x) => ({ ...x, baseSar: Number(e.target.value) }))} />,
            },
            {
              key: 'km',
              label: 'Per km',
              render: (c) => <input type="number" step="0.1" value={c.perKmSar} style={{ width: 64 }} onChange={(e) => patchClass(c.id, (x) => ({ ...x, perKmSar: Number(e.target.value) }))} />,
            },
            {
              key: 'min',
              label: 'Per min',
              render: (c) => <input type="number" step="0.05" value={c.perMinSar} style={{ width: 64 }} onChange={(e) => patchClass(c.id, (x) => ({ ...x, perMinSar: Number(e.target.value) }))} />,
            },
            {
              key: 'minfare',
              label: 'Min fare',
              render: (c) => <input type="number" value={c.minFareSar} style={{ width: 64 }} onChange={(e) => patchClass(c.id, (x) => ({ ...x, minFareSar: Number(e.target.value) }))} />,
            },
            {
              key: 'preview',
              label: 'Preview fare',
              render: (c) => {
                const issues = pricingIssues(c);
                return issues.length > 0 ? (
                  <span title={issues.join('; ')} style={{ color: '#ff8da1', fontSize: 12 }}>✕ invalid</span>
                ) : (
                  <strong>{sar(fareEstimate(c, REF_KM, REF_MIN, coreZone.multiplier))}</strong>
                );
              },
            },
            {
              key: 'active',
              label: 'State',
              render: (c) => (
                <button className={c.active ? 'btn primary' : 'btn'} onClick={() => patchClass(c.id, (x) => ({ ...x, active: !x.active }))}>
                  {c.active ? 'Live' : 'Paused'}
                </button>
              ),
            },
          ]}
          rows={state.classes}
        />
      </Card>

      <div className="grid cols-2">
        <Card
          title={`Surge zones — capped at ${SURGE_CAP.toFixed(1)}×`}
          foot="Multipliers clamp to the platform cap on entry; the cap itself is policy, changeable only by a super admin with an audit entry."
          data-testid="zones-card"
        >
          {state.zones.map((z) => (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{z.name}</span>
              <Badge tone={z.demand === 'peak' ? 'red' : z.demand === 'high' ? 'amber' : 'green'}>{z.demand}</Badge>
              <input
                type="number"
                step="0.1"
                min={1}
                max={SURGE_CAP}
                value={z.multiplier}
                style={{ width: 70 }}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    zones: prev.zones.map((x) =>
                      x.id === z.id ? { ...x, multiplier: Math.max(1, Math.min(SURGE_CAP, Number(e.target.value))) } : x,
                    ),
                  }))
                }
              />
              <span style={{ fontSize: 12, opacity: 0.65, width: 90, textAlign: 'right' }}>
                Go: {sar(fareEstimate(state.classes[0], REF_KM, REF_MIN, z.multiplier))}
              </span>
            </div>
          ))}
        </Card>

        <Card
          title="Shuttle routes"
          foot="Headway edits propagate to the rider app's live board; a dormant route keeps its stops and history."
          data-testid="shuttles-card"
        >
          {state.shuttles.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{s.name} · {s.stops} stops</span>
              <label style={{ fontSize: 12, opacity: 0.7 }}>
                every
                <input
                  type="number"
                  min={4}
                  value={s.headwayMin}
                  style={{ width: 56, margin: '0 6px' }}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      shuttles: prev.shuttles.map((x) => (x.id === s.id ? { ...x, headwayMin: Math.max(4, Number(e.target.value)) } : x)),
                    }))
                  }
                />
                min
              </label>
              <button
                className={s.active ? 'btn primary' : 'btn'}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    shuttles: prev.shuttles.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)),
                  }))
                }
              >
                {s.active ? 'Running' : 'Dormant'}
              </button>
            </div>
          ))}
        </Card>
      </div>

      <Card
        title="Ride promos"
        foot="A promo dies three ways: the window closes, someone pauses it, or the budget runs dry — exhaustion beats the clock, so spend can never exceed budget."
        data-testid="promos-card"
      >
        <div style={{ marginBottom: 10 }}>
          <button className="btn primary" onClick={newPromo}>+ New promo</button>
        </div>
        <DataTable<RidePromo>
          rowKey={(p) => p.id}
          columns={[
            {
              key: 'code',
              label: 'Code',
              render: (p) => (
                <input value={p.code} style={{ width: 110, fontFamily: 'monospace', letterSpacing: 1 }} onChange={(e) => patchPromo(p.id, (x) => ({ ...x, code: e.target.value.toUpperCase() }))} />
              ),
            },
            {
              key: 'value',
              label: 'Value',
              render: (p) => (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input type="number" value={p.value} style={{ width: 58 }} onChange={(e) => patchPromo(p.id, (x) => ({ ...x, value: Number(e.target.value) }))} />
                  <select value={p.kind} onChange={(e) => patchPromo(p.id, (x) => ({ ...x, kind: e.target.value as RidePromo['kind'] }))}>
                    <option value="percent">%</option>
                    <option value="amount">SAR</option>
                  </select>
                </span>
              ),
            },
            { key: 'cap', label: 'Cap/ride', render: (p) => sar(p.perRideCapSar) },
            {
              key: 'budget',
              label: 'Budget burn',
              render: (p) => {
                const pct = Math.min(100, Math.round((p.spentSar / p.budgetSar) * 100));
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', minWidth: 70 }}>
                      <span style={{ display: 'block', height: 6, borderRadius: 3, width: `${pct}%`, background: pct >= 95 ? '#ff8da1' : '#7ecb93' }} />
                    </span>
                    <span style={{ fontSize: 11.5 }}>{pct}%</span>
                  </span>
                );
              },
            },
            { key: 'red', label: 'Used', render: (p) => num(p.redemptions) },
            {
              key: 'state',
              label: 'State',
              render: (p) => {
                const issues = promoIssues(p);
                const eff = promoEffectiveState(p, TODAY_KEY);
                return (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={PROMO_TONE[eff]}>{eff}</Badge>
                    {issues.length > 0 ? (
                      <span title={issues.join('; ')} style={{ color: '#ff8da1', fontSize: 11 }}>✕</span>
                    ) : eff === 'draft' || eff === 'paused' ? (
                      <button className="btn primary" onClick={() => patchPromo(p.id, (x) => ({ ...x, state: 'live' }))}>Publish</button>
                    ) : eff === 'live' || eff === 'scheduled' ? (
                      <button className="btn" onClick={() => patchPromo(p.id, (x) => ({ ...x, state: 'paused' }))}>Pause</button>
                    ) : null}
                  </span>
                );
              },
            },
          ]}
          rows={state.promos}
        />
      </Card>

      <Card
        title="Incident queue"
        foot={`Response SLAs: SOS ${INCIDENT_SLA_HOURS.sos}h · safety ${INCIDENT_SLA_HOURS.safety}h · service ${INCIDENT_SLA_HOURS.service}h. A breach row stays red until resolved — it never quietly ages out.`}
        data-testid="incidents-card"
      >
        <DataTable<RafiqIncident>
          rowKey={(i) => i.id}
          columns={[
            { key: 'ref', label: 'Reference', render: (i) => i.ref },
            {
              key: 'sev',
              label: 'Severity',
              render: (i) => <Badge tone={i.severity === 'sos' ? 'red' : i.severity === 'safety' ? 'amber' : 'peri'}>{i.severity}</Badge>,
            },
            { key: 'summary', label: 'Summary', render: (i) => <span style={{ fontSize: 12.5 }}>{i.summary}</span> },
            {
              key: 'age',
              label: 'Age vs SLA',
              render: (i) => (
                <span style={{ color: incidentBreached(i) ? '#ff8da1' : undefined, fontSize: 12.5 }}>
                  {i.ageHours}h / {INCIDENT_SLA_HOURS[i.severity]}h{incidentBreached(i) ? ' — BREACH' : ''}
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              render: (i) =>
                i.status === 'resolved' ? (
                  <Badge tone="green">resolved</Badge>
                ) : (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    {i.status === 'open' && (
                      <button className="btn" onClick={() => setState((prev) => ({ ...prev, incidents: prev.incidents.map((x) => (x.id === i.id ? { ...x, status: 'acknowledged' } : x)) }))}>
                        Acknowledge
                      </button>
                    )}
                    <button className="btn primary" onClick={() => setState((prev) => ({ ...prev, incidents: prev.incidents.map((x) => (x.id === i.id ? { ...x, status: 'resolved' } : x)) }))}>
                      Resolve
                    </button>
                  </span>
                ),
            },
          ]}
          rows={state.incidents}
        />
      </Card>
    </>
  );
}
