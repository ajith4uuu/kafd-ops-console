// Rafiq mobility operations engine (pure module, unit-testable).
// End-to-end fleet admin: TGA-compliant driver lifecycle, vehicle documents,
// no-code pricing and surge-zone controls, shuttle routes, ride promos and
// the incident queue. Saudi rules are encoded as data, not prose: drivers
// must be Saudi citizens (Absher-verified), 25+, carry a TGA driver card
// (medical + first aid + competency + clean record), and vehicles need a TGA
// operating card, valid istimara and insurance, four doors, working AC, and
// a model year inside the class window.

// ---------------------------------------------------------------- ride classes

export type RideClassId = 'go' | 'comfort' | 'ladies' | 'xl' | 'ev';

export interface RideClassPricing {
  id: RideClassId;
  label: string;
  baseSar: number;
  perKmSar: number;
  perMinSar: number;
  minFareSar: number;
  /** Oldest accepted model year for this tier (window moves every January). */
  minModelYear: number;
  active: boolean;
}

export const SEED_CLASSES: readonly RideClassPricing[] = [
  { id: 'go', label: 'Rafiq Go', baseSar: 6, perKmSar: 1.6, perMinSar: 0.45, minFareSar: 12, minModelYear: 2021, active: true },
  { id: 'comfort', label: 'Comfort', baseSar: 9, perKmSar: 2.2, perMinSar: 0.6, minFareSar: 18, minModelYear: 2023, active: true },
  { id: 'ladies', label: 'Ladies', baseSar: 8, perKmSar: 2.0, perMinSar: 0.55, minFareSar: 16, minModelYear: 2021, active: true },
  { id: 'xl', label: 'XL', baseSar: 12, perKmSar: 2.8, perMinSar: 0.7, minFareSar: 24, minModelYear: 2021, active: true },
  { id: 'ev', label: 'EV Green', baseSar: 8, perKmSar: 1.9, perMinSar: 0.5, minFareSar: 15, minModelYear: 2023, active: false },
];

export function pricingIssues(p: RideClassPricing): string[] {
  const issues: string[] = [];
  if (p.baseSar < 0) issues.push('Base fare cannot be negative');
  if (p.perKmSar <= 0) issues.push('Per-km rate must be positive');
  if (p.perMinSar < 0) issues.push('Per-minute rate cannot be negative');
  if (p.minFareSar < p.baseSar) issues.push('Minimum fare must cover the base fare');
  return issues;
}

/** Surge multipliers are capped platform-wide — no 4x storms at KAFD. */
export const SURGE_CAP = 2.0;

export function fareEstimate(p: RideClassPricing, km: number, minutes: number, multiplier: number): number {
  const m = Math.max(1, Math.min(SURGE_CAP, multiplier));
  const metered = p.baseSar + p.perKmSar * km + p.perMinSar * minutes;
  return Math.round(Math.max(p.minFareSar, metered) * m * 100) / 100;
}

// ---------------------------------------------------------------- zones

export interface SurgeZone {
  id: string;
  name: string;
  multiplier: number;
  demand: 'low' | 'normal' | 'high' | 'peak';
}

export const SEED_ZONES: readonly SurgeZone[] = [
  { id: 'z-core', name: 'Financial core', multiplier: 1.4, demand: 'peak' },
  { id: 'z-wadi', name: 'Wadi promenade', multiplier: 1.2, demand: 'high' },
  { id: 'z-res', name: 'Residential towers', multiplier: 1.0, demand: 'normal' },
  { id: 'z-gates', name: 'Gate parking belt', multiplier: 1.1, demand: 'high' },
  { id: 'z-metro', name: 'Metro interchange', multiplier: 1.0, demand: 'low' },
];

// ---------------------------------------------------------------- drivers & vehicles

export interface FleetVehicle {
  id: string;
  plate: string;
  model: string;
  modelYear: number;
  doors: number;
  acWorking: boolean;
  classId: RideClassId;
  operatingCardExpiry: string;
  istimaraExpiry: string;
  insuranceExpiry: string;
  inspectionPassed: boolean;
}

export interface RafiqDriver {
  id: string;
  name: string;
  age: number;
  saudiCitizen: boolean;
  absherVerified: boolean;
  tgaCardExpiry: string;
  medicalExpiry: string;
  firstAidExpiry: string;
  competencyPassed: boolean;
  criminalRecordClean: boolean;
  licenceExpiry: string;
  rating: number;
  trips: number;
  acceptRate: number;
  vehicleId: string | null;
  status: 'active' | 'suspended' | 'onboarding';
}

/** Everything blocking a driver from going (or staying) live, in display order. */
export function driverIssues(d: RafiqDriver, vehicle: FleetVehicle | null, classes: readonly RideClassPricing[], todayKey: string): string[] {
  const issues: string[] = [];
  if (!d.saudiCitizen) issues.push('Ride-hailing driving is reserved for Saudi citizens (TGA)');
  if (!d.absherVerified) issues.push('Absher identity verification pending');
  if (d.age < 25) issues.push('Drivers must be at least 25');
  if (d.tgaCardExpiry <= todayKey) issues.push('TGA driver card expired');
  if (d.medicalExpiry <= todayKey) issues.push('TGA medical examination expired');
  if (d.firstAidExpiry <= todayKey) issues.push('First aid certificate expired');
  if (!d.competencyPassed) issues.push('Professional competency test not passed');
  if (!d.criminalRecordClean) issues.push('Criminal record check failed');
  if (d.licenceExpiry <= todayKey) issues.push('Driving licence expired');
  if (!vehicle) issues.push('No vehicle assigned');
  else {
    if (vehicle.operatingCardExpiry <= todayKey) issues.push('Vehicle TGA operating card expired');
    if (vehicle.istimaraExpiry <= todayKey) issues.push('Istimara (registration) expired');
    if (vehicle.insuranceExpiry <= todayKey) issues.push('Insurance expired');
    if (!vehicle.inspectionPassed) issues.push('Vehicle inspection not passed');
    if (vehicle.doors < 4) issues.push('Four doors are required');
    if (!vehicle.acWorking) issues.push('Working AC is required');
    const cls = classes.find((c) => c.id === vehicle.classId);
    if (cls && vehicle.modelYear < cls.minModelYear) issues.push(`Model year below the ${cls.label} window (${cls.minModelYear}+)`);
  }
  return issues;
}

export function canActivate(d: RafiqDriver, vehicle: FleetVehicle | null, classes: readonly RideClassPricing[], todayKey: string): boolean {
  return driverIssues(d, vehicle, classes, todayKey).length === 0;
}

export interface ExpiringDoc {
  holder: string;
  doc: string;
  expiry: string;
}

/** Documents expiring within `days` of today — the renewal chase list. */
export function expiringDocs(
  drivers: readonly RafiqDriver[],
  vehicles: readonly FleetVehicle[],
  todayKey: string,
  days: number,
): ExpiringDoc[] {
  const limit = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() + days * 86400_000).toISOString().slice(0, 10);
  const out: ExpiringDoc[] = [];
  const push = (holder: string, doc: string, expiry: string) => {
    if (expiry > todayKey && expiry <= limit) out.push({ holder, doc, expiry });
  };
  for (const d of drivers) {
    push(d.name, 'TGA driver card', d.tgaCardExpiry);
    push(d.name, 'TGA medical', d.medicalExpiry);
    push(d.name, 'First aid certificate', d.firstAidExpiry);
    push(d.name, 'Driving licence', d.licenceExpiry);
  }
  for (const v of vehicles) {
    push(v.plate, 'Operating card', v.operatingCardExpiry);
    push(v.plate, 'Istimara', v.istimaraExpiry);
    push(v.plate, 'Insurance', v.insuranceExpiry);
  }
  return out.sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
}

export const SEED_VEHICLES: readonly FleetVehicle[] = [
  { id: 'veh-01', plate: 'RUH 4821', model: 'Camry Hybrid', modelYear: 2024, doors: 4, acWorking: true, classId: 'go', operatingCardExpiry: '2027-03-14', istimaraExpiry: '2027-01-09', insuranceExpiry: '2026-12-02', inspectionPassed: true },
  { id: 'veh-02', plate: 'RUH 5530', model: 'Sonata', modelYear: 2023, doors: 4, acWorking: true, classId: 'go', operatingCardExpiry: '2026-09-08', istimaraExpiry: '2027-04-22', insuranceExpiry: '2027-02-17', inspectionPassed: true },
  { id: 'veh-03', plate: 'RUH 7714', model: 'Lexus ES', modelYear: 2024, doors: 4, acWorking: true, classId: 'comfort', operatingCardExpiry: '2027-06-30', istimaraExpiry: '2027-05-11', insuranceExpiry: '2027-03-28', inspectionPassed: true },
  { id: 'veh-04', plate: 'RUH 3390', model: 'Camry', modelYear: 2022, doors: 4, acWorking: true, classId: 'ladies', operatingCardExpiry: '2027-02-01', istimaraExpiry: '2026-11-19', insuranceExpiry: '2026-10-30', inspectionPassed: true },
  { id: 'veh-05', plate: 'RUH 6118', model: 'GMC Yukon', modelYear: 2023, doors: 4, acWorking: true, classId: 'xl', operatingCardExpiry: '2027-08-15', istimaraExpiry: '2027-07-04', insuranceExpiry: '2027-05-21', inspectionPassed: true },
  { id: 'veh-06', plate: 'RUH 2245', model: 'Accord', modelYear: 2019, doors: 4, acWorking: true, classId: 'go', operatingCardExpiry: '2027-04-10', istimaraExpiry: '2027-03-02', insuranceExpiry: '2027-01-15', inspectionPassed: true },
  { id: 'veh-07', plate: 'RUH 8807', model: 'Ioniq 6', modelYear: 2025, doors: 4, acWorking: true, classId: 'ev', operatingCardExpiry: '2027-09-01', istimaraExpiry: '2027-08-12', insuranceExpiry: '2027-06-24', inspectionPassed: true },
  { id: 'veh-08', plate: 'RUH 1163', model: 'Sonata', modelYear: 2024, doors: 4, acWorking: false, classId: 'go', operatingCardExpiry: '2027-05-18', istimaraExpiry: '2027-04-06', insuranceExpiry: '2027-02-09', inspectionPassed: true },
];

export const SEED_DRIVERS: readonly RafiqDriver[] = [
  { id: 'drv-01', name: 'Saad Al-Qahtani', age: 31, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-04-12', medicalExpiry: '2027-02-18', firstAidExpiry: '2026-12-05', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2028-06-30', rating: 4.92, trips: 2841, acceptRate: 0.96, vehicleId: 'veh-01', status: 'active' },
  { id: 'drv-02', name: 'Meshal Al-Harbi', age: 28, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2026-09-08', medicalExpiry: '2027-01-22', firstAidExpiry: '2027-03-14', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2027-11-02', rating: 4.85, trips: 1963, acceptRate: 0.93, vehicleId: 'veh-02', status: 'active' },
  { id: 'drv-03', name: 'Turki Al-Dossari', age: 35, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-07-25', medicalExpiry: '2027-05-30', firstAidExpiry: '2027-04-08', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2029-01-17', rating: 4.97, trips: 4102, acceptRate: 0.98, vehicleId: 'veh-03', status: 'active' },
  { id: 'drv-04', name: 'Noura Al-Shammari', age: 29, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-03-19', medicalExpiry: '2027-06-11', firstAidExpiry: '2027-02-27', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2028-09-14', rating: 4.99, trips: 2277, acceptRate: 0.97, vehicleId: 'veh-04', status: 'active' },
  { id: 'drv-05', name: 'Bandar Al-Otaibi', age: 41, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-05-06', medicalExpiry: '2027-04-15', firstAidExpiry: '2027-01-30', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2027-12-08', rating: 4.81, trips: 3518, acceptRate: 0.91, vehicleId: 'veh-05', status: 'active' },
  { id: 'drv-06', name: 'Fahad Al-Zahrani', age: 26, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-06-20', medicalExpiry: '2026-07-04', firstAidExpiry: '2027-05-16', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2028-03-25', rating: 4.63, trips: 887, acceptRate: 0.88, vehicleId: 'veh-06', status: 'suspended' },
  { id: 'drv-07', name: 'Rakan Al-Mutairi', age: 33, saudiCitizen: true, absherVerified: true, tgaCardExpiry: '2027-08-02', medicalExpiry: '2027-07-09', firstAidExpiry: '2027-06-01', competencyPassed: true, criminalRecordClean: true, licenceExpiry: '2028-10-21', rating: 4.9, trips: 1544, acceptRate: 0.95, vehicleId: 'veh-07', status: 'active' },
  { id: 'drv-08', name: 'Ziyad Al-Ghamdi', age: 24, saudiCitizen: true, absherVerified: false, tgaCardExpiry: '2027-09-15', medicalExpiry: '2027-08-23', firstAidExpiry: '2027-07-12', competencyPassed: false, criminalRecordClean: true, licenceExpiry: '2029-02-06', rating: 0, trips: 0, acceptRate: 0, vehicleId: 'veh-08', status: 'onboarding' },
];

// ---------------------------------------------------------------- onboarding

export type OnboardingStage = 'applied' | 'absher' | 'tga_card' | 'inspection' | 'training' | 'live';

export const ONBOARDING_STAGES: readonly OnboardingStage[] = ['applied', 'absher', 'tga_card', 'inspection', 'training', 'live'];

export const STAGE_LABELS: Readonly<Record<OnboardingStage, string>> = {
  applied: 'Application',
  absher: 'Absher identity',
  tga_card: 'TGA driver card',
  inspection: 'Vehicle inspection',
  training: 'KAFD training',
  live: 'Live on Rafiq',
};

export function nextOnboardingStage(stage: OnboardingStage): OnboardingStage | null {
  const i = ONBOARDING_STAGES.indexOf(stage);
  return i >= 0 && i < ONBOARDING_STAGES.length - 1 ? ONBOARDING_STAGES[i + 1] : null;
}

export interface OnboardingCandidate {
  id: string;
  name: string;
  stage: OnboardingStage;
  daysInStage: number;
}

export const SEED_CANDIDATES: readonly OnboardingCandidate[] = [
  { id: 'cand-01', name: 'Ziyad Al-Ghamdi', stage: 'tga_card', daysInStage: 4 },
  { id: 'cand-02', name: 'Lama Al-Subaie', stage: 'absher', daysInStage: 1 },
  { id: 'cand-03', name: 'Nawaf Al-Anazi', stage: 'training', daysInStage: 2 },
  { id: 'cand-04', name: 'Joud Al-Rashidi', stage: 'applied', daysInStage: 0 },
];

// ---------------------------------------------------------------- shuttles

export interface ShuttleRoute {
  id: string;
  name: string;
  stops: number;
  headwayMin: number;
  active: boolean;
}

export const SEED_SHUTTLES: readonly ShuttleRoute[] = [
  { id: 'sh-metro', name: 'Metro loop', stops: 6, headwayMin: 8, active: true },
  { id: 'sh-gates', name: 'Gates express', stops: 4, headwayMin: 12, active: true },
  { id: 'sh-wadi', name: 'Wadi evening line', stops: 5, headwayMin: 15, active: false },
];

// ---------------------------------------------------------------- promos

export type PromoState = 'draft' | 'scheduled' | 'live' | 'paused' | 'expired' | 'exhausted';

export interface RidePromo {
  id: string;
  code: string;
  kind: 'percent' | 'amount';
  value: number;
  perRideCapSar: number;
  budgetSar: number;
  spentSar: number;
  validFrom: string;
  validTo: string;
  audience: 'everyone' | 'commuters' | 'residents' | 'first_ride';
  state: 'draft' | 'live' | 'paused';
  redemptions: number;
}

export const MAX_RIDE_PERCENT = 50;

export function promoIssues(p: RidePromo): string[] {
  const issues: string[] = [];
  if (!/^[A-Z0-9]{4,12}$/.test(p.code)) issues.push('Code must be 4–12 characters, A–Z and digits');
  if (p.kind === 'percent' && (p.value <= 0 || p.value > MAX_RIDE_PERCENT)) issues.push(`Percent promos must be 1–${MAX_RIDE_PERCENT}%`);
  if (p.kind === 'amount' && p.value <= 0) issues.push('Amount must be positive');
  if (p.perRideCapSar <= 0) issues.push('Per-ride cap must be positive');
  if (p.budgetSar <= 0) issues.push('Budget must be positive');
  if (p.validTo <= p.validFrom) issues.push('End date must follow start date');
  return issues;
}

/** Display state from stored state + clock + budget — exhausted beats the clock. */
export function promoEffectiveState(p: RidePromo, todayKey: string): PromoState {
  if (p.state === 'draft' || p.state === 'paused') return p.state;
  if (p.spentSar >= p.budgetSar) return 'exhausted';
  if (todayKey < p.validFrom) return 'scheduled';
  if (todayKey > p.validTo) return 'expired';
  return 'live';
}

export const SEED_PROMOS: readonly RidePromo[] = [
  { id: 'pr-01', code: 'KAFD15', kind: 'amount', value: 15, perRideCapSar: 15, budgetSar: 25000, spentSar: 11240, validFrom: '2026-08-01', validTo: '2026-09-30', audience: 'first_ride', state: 'live', redemptions: 749 },
  { id: 'pr-02', code: 'COMMUTE20', kind: 'percent', value: 20, perRideCapSar: 12, budgetSar: 18000, spentSar: 17940, validFrom: '2026-07-15', validTo: '2026-09-15', audience: 'commuters', state: 'live', redemptions: 1495 },
  { id: 'pr-03', code: 'EIDRIDE', kind: 'percent', value: 25, perRideCapSar: 20, budgetSar: 30000, spentSar: 0, validFrom: '2026-09-20', validTo: '2026-09-27', audience: 'everyone', state: 'live', redemptions: 0 },
  { id: 'pr-04', code: 'LADIES10', kind: 'percent', value: 10, perRideCapSar: 10, budgetSar: 8000, spentSar: 0, validFrom: '2026-08-15', validTo: '2026-10-15', audience: 'residents', state: 'draft', redemptions: 0 },
];

// ---------------------------------------------------------------- incidents

export type IncidentSeverity = 'sos' | 'safety' | 'service';

/** Response SLA per severity, in hours. */
export const INCIDENT_SLA_HOURS: Readonly<Record<IncidentSeverity, number>> = {
  sos: 1,
  safety: 4,
  service: 24,
};

export interface RafiqIncident {
  id: string;
  ref: string;
  severity: IncidentSeverity;
  summary: string;
  tripRef: string;
  ageHours: number;
  status: 'open' | 'acknowledged' | 'resolved';
}

export function incidentBreached(i: RafiqIncident): boolean {
  return i.status !== 'resolved' && i.ageHours > INCIDENT_SLA_HOURS[i.severity];
}

export const SEED_INCIDENTS: readonly RafiqIncident[] = [
  { id: 'inc-01', ref: 'INC-2026-0912', severity: 'sos', summary: 'SOS button pressed, rider confirmed safe — follow-up call due', tripRef: 'TRP-88412', ageHours: 0.5, status: 'acknowledged' },
  { id: 'inc-02', ref: 'INC-2026-0911', severity: 'safety', summary: 'Harsh braking pattern flagged on three consecutive trips', tripRef: 'TRP-88395', ageHours: 2, status: 'open' },
  { id: 'inc-03', ref: 'INC-2026-0910', severity: 'service', summary: 'Lost item — laptop bag reported in Comfort trip', tripRef: 'TRP-88371', ageHours: 6, status: 'acknowledged' },
  { id: 'inc-04', ref: 'INC-2026-0907', severity: 'service', summary: 'Fare dispute — rider charged surge after app showed 1.0x', tripRef: 'TRP-88204', ageHours: 30, status: 'open' },
  { id: 'inc-05', ref: 'INC-2026-0903', severity: 'safety', summary: 'Seatbelt sensor fault reported by driver', tripRef: 'TRP-88016', ageHours: 52, status: 'resolved' },
];
