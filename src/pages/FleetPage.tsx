import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num } from '../components/ui';
import { TODAY_KEY } from '../data/seed';
import {
  ONBOARDING_STAGES,
  SEED_CANDIDATES,
  SEED_CLASSES,
  SEED_DRIVERS,
  SEED_VEHICLES,
  STAGE_LABELS,
  canActivate,
  driverIssues,
  expiringDocs,
  nextOnboardingStage,
  type FleetVehicle,
  type OnboardingCandidate,
  type RafiqDriver,
} from '../data/rafiqops';

const STORE_KEY = 'kafd-fleet-v1';

interface FleetState {
  drivers: RafiqDriver[];
  candidates: OnboardingCandidate[];
}

function loadFleet(): FleetState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as FleetState;
  } catch {
    // fall through to seeds
  }
  return { drivers: [...SEED_DRIVERS], candidates: [...SEED_CANDIDATES] };
}

function docBadge(expiry: string): { tone: 'green' | 'amber' | 'red'; label: string } {
  if (expiry <= TODAY_KEY) return { tone: 'red', label: `expired ${expiry}` };
  const soon = new Date(new Date(`${TODAY_KEY}T00:00:00Z`).getTime() + 30 * 86400_000).toISOString().slice(0, 10);
  if (expiry <= soon) return { tone: 'amber', label: `renew by ${expiry}` };
  return { tone: 'green', label: expiry };
}

export function FleetPage() {
  const [fleet, setFleet] = useState<FleetState>(loadFleet);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(fleet));
    } catch {
      // quota — session copy stays in memory
    }
  }, [fleet]);

  const vehicleOf = (d: RafiqDriver): FleetVehicle | null =>
    SEED_VEHICLES.find((v) => v.id === d.vehicleId) ?? null;

  const active = fleet.drivers.filter((d) => d.status === 'active');
  const chase = expiringDocs(fleet.drivers, SEED_VEHICLES, TODAY_KEY, 30);
  const compliant = fleet.drivers.filter((d) => canActivate(d, vehicleOf(d), SEED_CLASSES, TODAY_KEY)).length;

  const patchDriver = (id: string, updater: (d: RafiqDriver) => RafiqDriver) =>
    setFleet((prev) => ({ ...prev, drivers: prev.drivers.map((d) => (d.id === id ? updater(d) : d)) }));

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Drivers" value={num(fleet.drivers.length)} />
        <Kpi label="Active" value={String(active.length)} />
        <Kpi label="Onboarding" value={String(fleet.candidates.filter((c) => c.stage !== 'live').length)} />
        <Kpi label="Suspended" value={String(fleet.drivers.filter((d) => d.status === 'suspended').length)} />
        <Kpi label="TGA-compliant" value={`${compliant}/${fleet.drivers.length}`} />
        <Kpi label="Docs expiring 30d" value={String(chase.length)} />
        <Kpi label="Fleet avg rating" value={active.length ? (active.reduce((s, d) => s + d.rating, 0) / active.length).toFixed(2) : '—'} />
      </div>

      <Card
        title="TGA compliance — encoded, not advised"
        foot="Saudi-citizen drivers verified via Absher, 25+, TGA driver card (medical + first aid + competency + clean record); vehicles carry a TGA operating card, valid istimara and insurance, four doors, working AC, and a model year inside the class window. Violations carry fines to SAR 20,000 — the roster refuses what the regulator refuses."
        data-testid="tga-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="green">Saudi citizens only — Absher-verified</Badge>
          <Badge tone="peri">TGA driver card per driver</Badge>
          <Badge tone="peri">Operating card per vehicle</Badge>
          <Badge tone="amber">Model-year windows per tier</Badge>
        </div>
      </Card>

      <Card
        title="Driver roster"
        foot="Activate is gated on the full TGA checklist — the disabled control lists exactly what blocks it. Suspension cuts dispatch immediately; the driver keeps portal access to fix documents."
        data-testid="roster-card"
      >
        <DataTable<RafiqDriver>
          rowKey={(d) => d.id}
          columns={[
            { key: 'name', label: 'Driver', render: (d) => d.name },
            {
              key: 'vehicle',
              label: 'Vehicle',
              render: (d) => {
                const v = vehicleOf(d);
                return v ? `${v.model} ${v.modelYear} · ${v.plate}` : '—';
              },
            },
            { key: 'class', label: 'Tier', render: (d) => SEED_CLASSES.find((c) => c.id === vehicleOf(d)?.classId)?.label ?? '—' },
            { key: 'rating', label: 'Rating', render: (d) => (d.trips > 0 ? `★ ${d.rating.toFixed(2)} · ${num(d.trips)} trips` : 'new') },
            {
              key: 'tga',
              label: 'TGA card',
              render: (d) => {
                const b = docBadge(d.tgaCardExpiry);
                return <Badge tone={b.tone}>{b.label}</Badge>;
              },
            },
            {
              key: 'status',
              label: 'Status',
              render: (d) => (
                <Badge tone={d.status === 'active' ? 'green' : d.status === 'onboarding' ? 'peri' : 'red'}>{d.status}</Badge>
              ),
            },
            {
              key: 'action',
              label: '',
              render: (d) => {
                const issues = driverIssues(d, vehicleOf(d), SEED_CLASSES, TODAY_KEY);
                if (d.status === 'active') {
                  return <button className="btn" onClick={() => patchDriver(d.id, (x) => ({ ...x, status: 'suspended' }))}>Suspend</button>;
                }
                return (
                  <button
                    className="btn primary"
                    disabled={issues.length > 0}
                    title={issues.join('; ')}
                    onClick={() => patchDriver(d.id, (x) => ({ ...x, status: 'active' }))}
                  >
                    Activate{issues.length > 0 ? ` (${issues.length} blocks)` : ''}
                  </button>
                );
              },
            },
          ]}
          rows={fleet.drivers}
        />
      </Card>

      <div className="grid cols-2">
        <Card
          title="Vehicle registry"
          foot="Operating card, istimara and insurance are tracked per vehicle; a failed inspection or broken AC pulls the car from dispatch regardless of the driver's standing."
          data-testid="vehicles-card"
        >
          <DataTable<FleetVehicle>
            rowKey={(v) => v.id}
            columns={[
              { key: 'plate', label: 'Plate', render: (v) => v.plate },
              { key: 'model', label: 'Vehicle', render: (v) => `${v.model} ${v.modelYear}` },
              { key: 'class', label: 'Tier', render: (v) => SEED_CLASSES.find((c) => c.id === v.classId)?.label ?? v.classId },
              {
                key: 'opcard',
                label: 'Operating card',
                render: (v) => {
                  const b = docBadge(v.operatingCardExpiry);
                  return <Badge tone={b.tone}>{b.label}</Badge>;
                },
              },
              {
                key: 'fit',
                label: 'Fit for dispatch',
                render: (v) => {
                  const cls = SEED_CLASSES.find((c) => c.id === v.classId);
                  const fit = v.inspectionPassed && v.acWorking && v.doors >= 4 && (cls == null || v.modelYear >= cls.minModelYear);
                  return <Badge tone={fit ? 'green' : 'red'}>{fit ? 'Yes' : 'No'}</Badge>;
                },
              },
            ]}
            rows={[...SEED_VEHICLES]}
          />
        </Card>

        <Card
          title="Onboarding pipeline"
          foot="Application → Absher identity → TGA driver card → vehicle inspection → KAFD training → live. Each stage advance writes to the audit trail."
          data-testid="onboarding-card"
        >
          {fleet.candidates.map((c) => {
            const idx = ONBOARDING_STAGES.indexOf(c.stage);
            const next = nextOnboardingStage(c.stage);
            return (
              <div key={c.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <strong>{c.name}</strong>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={c.stage === 'live' ? 'green' : 'peri'}>{STAGE_LABELS[c.stage]}</Badge>
                    {next && (
                      <button
                        className="btn"
                        onClick={() =>
                          setFleet((prev) => ({
                            ...prev,
                            candidates: prev.candidates.map((x) => (x.id === c.id ? { ...x, stage: next, daysInStage: 0 } : x)),
                          }))
                        }
                      >
                        → {STAGE_LABELS[next]}
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {ONBOARDING_STAGES.map((s, i) => (
                    <div key={s} title={STAGE_LABELS[s]} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= idx ? '#7ecb93' : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card
        title={`Document renewals due in 30 days (${chase.length})`}
        foot="The chase list is what keeps the compliant count at 100% — renew before expiry and the roster never blocks a shift."
        data-testid="renewals-card"
      >
        {chase.length === 0 ? (
          <span style={{ fontSize: 13, opacity: 0.6 }}>Nothing due — the fleet is clean for the next 30 days.</span>
        ) : (
          chase.map((e) => (
            <div key={`${e.holder}-${e.doc}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span>{e.holder} — {e.doc}</span>
              <Badge tone="amber">{e.expiry}</Badge>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
