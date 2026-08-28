// Property portfolio + AI-walkthrough + CMS engine (pure module, unit-testable).
// Mirrors the KAFD-BNB walkthrough pipeline: photos are classified into route
// slots at upload time, stored already ordered, and the walkthrough player and
// video compiler read the same sequence. Saudi compliance rules (REGA/FAL,
// deposit and brokerage caps, tourism licence) gate the listing lifecycle.

// ---------------------------------------------------------------- route model

export type RouteSlot =
  | 'outside' | 'entrance' | 'living' | 'dining' | 'kitchen' | 'bedroom'
  | 'bathroom' | 'study' | 'patio' | 'amenity' | 'final_exterior';

export interface RouteStop {
  slot: RouteSlot;
  order: number;
  optional: boolean;
  /** Camera direction arriving at this stop — read verbatim by the narrator. */
  camera: string;
}

export const ROUTE: readonly RouteStop[] = [
  { slot: 'outside', order: 10, optional: false, camera: 'a slow steady push toward the building entrance' },
  { slot: 'entrance', order: 20, optional: false, camera: 'through the doorway as the interior opens up' },
  { slot: 'living', order: 30, optional: false, camera: 'gliding forward, then pulling back to reveal the full width' },
  { slot: 'dining', order: 35, optional: true, camera: 'drifting sideways past the dining table' },
  { slot: 'kitchen', order: 40, optional: false, camera: 'pushing in, tracking along the counter' },
  { slot: 'bedroom', order: 50, optional: true, camera: 'turning down the hallway into the bedroom' },
  { slot: 'bathroom', order: 60, optional: true, camera: 'stepping sideways into the bathroom' },
  { slot: 'study', order: 65, optional: true, camera: 'turning toward the study and settling' },
  { slot: 'patio', order: 70, optional: false, camera: 'through the glass doors onto the terrace' },
  { slot: 'amenity', order: 80, optional: true, camera: 'drifting through the shared amenity space' },
  { slot: 'final_exterior', order: 90, optional: false, camera: 'pulling back and rising to reveal the district' },
];

export const SLOT_LABEL: Readonly<Record<RouteSlot, string>> = {
  outside: 'Outside',
  entrance: 'Entrance',
  living: 'Living',
  dining: 'Dining',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  study: 'Study',
  patio: 'Patio',
  amenity: 'Amenity',
  final_exterior: 'Skyline finale',
};

/** Filename keywords per slot; the LONGEST match wins (bathroom beats bath). */
const SLOT_KEYWORDS: readonly [string, RouteSlot][] = [
  ['final', 'final_exterior'], ['skyline', 'final_exterior'], ['aerial', 'final_exterior'],
  ['outside', 'outside'], ['exterior', 'outside'], ['facade', 'outside'], ['front', 'outside'],
  ['entrance', 'entrance'], ['entry', 'entrance'], ['lobby', 'entrance'], ['foyer', 'entrance'],
  ['living', 'living'], ['lounge', 'living'], ['majlis', 'living'],
  ['dining', 'dining'],
  ['kitchen', 'kitchen'],
  ['bedroom', 'bedroom'], ['master', 'bedroom'], ['bed', 'bedroom'],
  ['bathroom', 'bathroom'], ['ensuite', 'bathroom'], ['bath', 'bathroom'], ['wc', 'bathroom'],
  ['study', 'study'], ['office', 'study'],
  ['patio', 'patio'], ['terrace', 'patio'], ['balcony', 'patio'],
  ['amenity', 'amenity'], ['gym', 'amenity'], ['pool', 'amenity'],
];

/** Classify an uploaded filename into a route slot; null when nothing matches. */
export function classifyPhoto(filename: string): RouteSlot | null {
  const name = filename.toLowerCase();
  let best: { slot: RouteSlot; len: number } | null = null;
  for (const [kw, slot] of SLOT_KEYWORDS) {
    if (name.includes(kw) && (best == null || kw.length > best.len)) best = { slot, len: kw.length };
  }
  return best?.slot ?? null;
}

export interface PropertyPhoto {
  id: string;
  /** Data URI or generated placeholder. */
  src: string;
  filename: string;
  slot: RouteSlot | null;
  /** 'pinned' = admin override; 'auto' = classified from filename. */
  slotSource: 'auto' | 'pinned';
}

/**
 * Order photos along the canonical route. Unclassified photos go last in
 * upload order; if nothing opens the tour, the first photo is promoted to
 * `outside` — a tour that opens in a kitchen reads as a jump cut.
 */
export function orderPhotos(photos: readonly PropertyPhoto[]): PropertyPhoto[] {
  const slotOrder = (slot: RouteSlot | null) =>
    slot == null ? 999 : ROUTE.find((r) => r.slot === slot)?.order ?? 999;
  const ordered = photos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => slotOrder(a.p.slot) - slotOrder(b.p.slot) || a.i - b.i)
    .map((x) => x.p);
  if (ordered.length > 0 && !ordered.some((p) => p.slot === 'outside')) {
    return [
      { ...ordered[0], slot: 'outside' as const, slotSource: 'auto' as const },
      ...ordered.slice(1),
    ];
  }
  return ordered;
}

/** One line of narration per stop — cinematic template (Claude-ready seam). */
export function narrationFor(slot: RouteSlot, property: { title: string; building: string; bedrooms: number }): string {
  switch (slot) {
    case 'outside':
      return `Welcome to ${property.title}, in the heart of ${property.building} at KAFD.`;
    case 'entrance':
      return 'Step inside — the entrance sets the tone with clean lines and warm light.';
    case 'living':
      return 'The living space opens wide, made for evenings that stretch out.';
    case 'dining':
      return 'A dining area that seats friends and family comfortably.';
    case 'kitchen':
      return 'The kitchen is fully fitted — stone counters, integrated appliances.';
    case 'bedroom':
      return property.bedrooms > 1
        ? `Each of the ${property.bedrooms} bedrooms is a quiet retreat above the district.`
        : 'The bedroom is a quiet retreat above the district.';
    case 'bathroom':
      return 'Bathrooms finished in stone and glass.';
    case 'study':
      return 'A study built for deep work, minutes from your meetings.';
    case 'patio':
      return 'Outside, the terrace frames the skyline.';
    case 'amenity':
      return 'Residents share a gym, pool and lounge floors.';
    case 'final_exterior':
      return 'This is KAFD living — walk everywhere, arrive in minutes.';
  }
}

export interface WalkthroughScene {
  photo: PropertyPhoto;
  slot: RouteSlot;
  camera: string;
  narration: string;
  /** Seconds this scene holds on screen. */
  seconds: number;
}

/** Build the ordered scene list the player and the video compiler both use. */
export function walkthroughPlan(
  photos: readonly PropertyPhoto[],
  property: { title: string; building: string; bedrooms: number },
): WalkthroughScene[] {
  return orderPhotos(photos)
    .filter((p) => p.slot != null)
    .map((photo) => {
      const slot = photo.slot as RouteSlot;
      return {
        photo,
        slot,
        camera: ROUTE.find((r) => r.slot === slot)?.camera ?? 'holding steady',
        narration: narrationFor(slot, property),
        seconds: slot === 'outside' || slot === 'final_exterior' ? 5 : 4,
      };
    });
}

// ---------------------------------------------------------------- property model

export type ListingType = 'residential' | 'commercial' | 'short_stay';
export type PropertyStatus = 'draft' | 'listed' | 'leased' | 'archived';

export interface ManagedProperty {
  id: string;
  title: string;
  building: string;
  unitNo: string;
  type: ListingType;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  /** Annual rent (residential/commercial) or nightly rate (short stay). */
  priceSar: number;
  depositSar: number;
  brokerageSar: number;
  regaAdLicense: string;
  falLicense: string;
  tourismLicense?: string;
  amenities: string[];
  description: string;
  status: PropertyStatus;
  photos: PropertyPhoto[];
  /** Set when a walkthrough video has been compiled this session. */
  walkthroughReady: boolean;
}

export const DEPOSIT_CAP = 0.05;
export const BROKERAGE_CAP = 0.025;
export const MIN_LISTING_PHOTOS = 4;

/** Everything that blocks a listing from going live, in display order. */
export function listingIssues(p: ManagedProperty): string[] {
  const issues: string[] = [];
  if (!p.title.trim()) issues.push('Title is required');
  if (!p.regaAdLicense.trim()) issues.push('REGA advertisement licence is mandatory before publication');
  if (!p.falLicense.trim()) issues.push('FAL licence number is mandatory on every advert');
  if (p.type === 'short_stay' && !p.tourismLicense?.trim()) issues.push('Short stays need a Ministry of Tourism licence');
  if (p.priceSar <= 0) issues.push('Price must be positive');
  if (p.type !== 'short_stay' && p.depositSar > p.priceSar * DEPOSIT_CAP + 0.005) issues.push('Deposit exceeds the 5% legal cap');
  if (p.type !== 'short_stay' && p.brokerageSar > p.priceSar * BROKERAGE_CAP + 0.005) issues.push('Brokerage exceeds the 2.5% legal cap');
  if (p.photos.length < MIN_LISTING_PHOTOS) issues.push(`At least ${MIN_LISTING_PHOTOS} photos before listing (${p.photos.length} uploaded)`);
  return issues;
}

export function canList(p: ManagedProperty): boolean {
  return listingIssues(p).length === 0;
}

// Placeholder "photos" for seeded units: room-toned SVG frames the player and
// compiler treat exactly like uploads.
const SLOT_TONES: Readonly<Record<RouteSlot, [string, string]>> = {
  outside: ['#28334a', '#4c5b78'],
  entrance: ['#3b4763', '#8894ad'],
  living: ['#2d3a55', '#c5a15c'],
  dining: ['#33405e', '#b08a4f'],
  kitchen: ['#2f3c58', '#7d94b8'],
  bedroom: ['#2a3650', '#9d8ab5'],
  bathroom: ['#2c3a57', '#7fb3c9'],
  study: ['#303c58', '#8aa07a'],
  patio: ['#26324b', '#e2a75e'],
  amenity: ['#2b3852', '#6fb59a'],
  final_exterior: ['#1d2740', '#e8b463'],
};

export function placeholderPhoto(slot: RouteSlot, label: string): string {
  const [a, b] = SLOT_TONES[slot];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="960" height="540" fill="url(#g)"/>` +
    `<g fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="3">` +
    `<rect x="120" y="120" width="300" height="220" rx="6"/>` +
    `<rect x="480" y="180" width="360" height="160" rx="6"/>` +
    `<line x1="0" y1="420" x2="960" y2="420"/></g>` +
    `<text x="60" y="490" font-family="Georgia,serif" font-size="38" fill="rgba(255,255,255,0.85)">${label}</text>` +
    `<text x="60" y="72" font-family="Arial,sans-serif" font-size="20" letter-spacing="6" fill="rgba(255,255,255,0.5)">KAFD LIVING</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function seedPhotos(unit: string, slots: RouteSlot[]): PropertyPhoto[] {
  return slots.map((slot, i) => ({
    id: `${unit}-ph-${i}`,
    src: placeholderPhoto(slot, SLOT_LABEL[slot]),
    filename: `${slot}.jpg`,
    slot,
    slotSource: 'auto' as const,
  }));
}

export const SEED_PROPERTIES: readonly ManagedProperty[] = [
  {
    id: 'prop-vue-e-1204',
    title: 'Vue East 1204 — Two-Bed Sky Residence',
    building: 'Vue East',
    unitNo: '1204',
    type: 'residential',
    bedrooms: 2,
    bathrooms: 2,
    sqm: 128,
    priceSar: 168000,
    depositSar: 8000,
    brokerageSar: 4000,
    regaAdLicense: '7200481250',
    falLicense: '1200018493',
    amenities: ['Smart home', 'Gym', 'Pool', 'Concierge'],
    description: 'Corner two-bedroom with a wraparound view of the Wadi promenade.',
    status: 'listed',
    photos: seedPhotos('vue-e-1204', ['outside', 'entrance', 'living', 'kitchen', 'bedroom', 'bathroom', 'patio', 'final_exterior']),
    walkthroughReady: false,
  },
  {
    id: 'prop-vue-w-803',
    title: 'Vue West 803 — One-Bed with Study',
    building: 'Vue West',
    unitNo: '803',
    type: 'residential',
    bedrooms: 1,
    bathrooms: 1,
    sqm: 84,
    priceSar: 112000,
    depositSar: 5500,
    brokerageSar: 2750,
    regaAdLicense: '7200481251',
    falLicense: '1200018493',
    amenities: ['Smart home', 'Gym', 'Co-working'],
    description: 'Efficient one-bedroom with a dedicated study, tuned for RHQ executives.',
    status: 'listed',
    photos: seedPhotos('vue-w-803', ['outside', 'living', 'kitchen', 'bedroom', 'study', 'final_exterior']),
    walkthroughReady: false,
  },
  {
    id: 'prop-bliss-1802',
    title: 'Bliss West 1802 — Serviced Short Stay',
    building: 'Bliss West',
    unitNo: '1802',
    type: 'short_stay',
    bedrooms: 1,
    bathrooms: 1,
    sqm: 76,
    priceSar: 980,
    depositSar: 0,
    brokerageSar: 0,
    regaAdLicense: '7200481252',
    falLicense: '1200018493',
    tourismLicense: 'MT-RYD-20481',
    amenities: ['Housekeeping', 'Pool', 'Gym'],
    description: 'Licensed nightly stay with weekend-uplift pricing and hotel-grade turnover.',
    status: 'listed',
    photos: seedPhotos('bliss-1802', ['outside', 'entrance', 'living', 'kitchen', 'bedroom', 'bathroom', 'amenity', 'final_exterior']),
    walkthroughReady: false,
  },
  {
    id: 'prop-207-1105',
    title: 'Tower 2.07 — 1105 Office Suite',
    building: 'Tower 2.07',
    unitNo: '1105',
    type: 'commercial',
    bedrooms: 0,
    bathrooms: 1,
    sqm: 210,
    priceSar: 384000,
    depositSar: 19000,
    brokerageSar: 9600,
    regaAdLicense: '7200481253',
    falLicense: '1200018493',
    amenities: ['Raised floors', 'Meeting suite', 'Parking'],
    description: 'Grade-A fitted office floor with district-cooling and IBM-managed BMS.',
    status: 'leased',
    photos: seedPhotos('207-1105', ['outside', 'entrance', 'living', 'study', 'final_exterior']),
    walkthroughReady: false,
  },
  {
    id: 'prop-vue-e-901',
    title: 'Vue East 901 — Draft Listing',
    building: 'Vue East',
    unitNo: '901',
    type: 'residential',
    bedrooms: 2,
    bathrooms: 2,
    sqm: 121,
    priceSar: 156000,
    depositSar: 7800,
    brokerageSar: 3900,
    regaAdLicense: '',
    falLicense: '1200018493',
    amenities: ['Smart home'],
    description: 'Awaiting REGA advertisement licence and photo shoot.',
    status: 'draft',
    photos: seedPhotos('vue-e-901', ['living', 'kitchen']),
    walkthroughReady: false,
  },
];

// ---------------------------------------------------------------- CMS: offers

export type OfferState = 'draft' | 'scheduled' | 'live' | 'paused' | 'expired';

export interface Offer {
  id: string;
  title: string;
  pillar: 'dine' | 'rafiq' | 'go' | 'living' | 'estate';
  kind: 'percent' | 'amount';
  value: number;
  validFrom: string;
  validTo: string;
  audience: 'everyone' | 'residents' | 'workers' | 'nafath_verified';
  state: OfferState;
  redemptions: number;
}

export const MAX_PERCENT_OFF = 50;

export function offerIssues(o: Offer): string[] {
  const issues: string[] = [];
  if (!o.title.trim()) issues.push('Title is required');
  if (o.kind === 'percent' && (o.value <= 0 || o.value > MAX_PERCENT_OFF)) issues.push(`Percent offers must be 1–${MAX_PERCENT_OFF}%`);
  if (o.kind === 'amount' && o.value <= 0) issues.push('Amount must be positive');
  if (o.validTo <= o.validFrom) issues.push('End date must follow start date');
  return issues;
}

/** State a valid offer should display, derived from the clock. */
export function offerEffectiveState(o: Offer, todayKey: string): OfferState {
  if (o.state === 'draft' || o.state === 'paused') return o.state;
  if (todayKey < o.validFrom) return 'scheduled';
  if (todayKey > o.validTo) return 'expired';
  return 'live';
}

export const SEED_OFFERS: readonly Offer[] = [
  { id: 'off-01', title: 'Dine week — 20% at Wadi restaurants', pillar: 'dine', kind: 'percent', value: 20, validFrom: '2026-08-24', validTo: '2026-09-07', audience: 'everyone', state: 'live', redemptions: 412 },
  { id: 'off-02', title: 'SAR 15 off first Rafiq work commute', pillar: 'rafiq', kind: 'amount', value: 15, validFrom: '2026-08-01', validTo: '2026-09-30', audience: 'workers', state: 'live', redemptions: 268 },
  { id: 'off-03', title: 'Free laundry pickup for residents', pillar: 'estate', kind: 'percent', value: 100, validFrom: '2026-09-15', validTo: '2026-09-22', audience: 'residents', state: 'draft', redemptions: 0 },
  { id: 'off-04', title: 'Ramadan iftar pre-order — 10% off', pillar: 'go', kind: 'percent', value: 10, validFrom: '2026-02-17', validTo: '2026-03-19', audience: 'everyone', state: 'live', redemptions: 1893 },
];

// ---------------------------------------------------------------- CMS: directory

export interface DirectoryEntry {
  id: string;
  name: string;
  category: 'dine' | 'retail' | 'services' | 'landmark';
  tower: string;
  blurb: string;
  visible: boolean;
  featured: boolean;
}

export const SEED_DIRECTORY: readonly DirectoryEntry[] = [
  { id: 'dir-il-baretto', name: 'Il Baretto', category: 'dine', tower: 'Wadi 1', blurb: 'Milanese dining on the promenade.', visible: true, featured: true },
  { id: 'dir-benoit', name: 'Benoit', category: 'dine', tower: 'Wadi 2', blurb: 'Parisian bistro, split lunch and dinner services.', visible: true, featured: false },
  { id: 'dir-12-cups', name: '12 Cups', category: 'dine', tower: 'Tower 4.07', blurb: 'Specialty coffee, around the clock.', visible: true, featured: true },
  { id: 'dir-zuma', name: 'Zuma', category: 'dine', tower: 'Wadi 1', blurb: 'Contemporary Japanese izakaya.', visible: true, featured: false },
  { id: 'dir-pharmacy', name: 'KAFD Pharmacy', category: 'services', tower: 'Tower 1.15', blurb: 'Daily essentials and prescriptions.', visible: true, featured: false },
  { id: 'dir-gallery', name: 'The Gallery', category: 'retail', tower: 'Wadi 3', blurb: 'Curated fashion and lifestyle.', visible: false, featured: false },
  { id: 'dir-mosque', name: 'KAFD Grand Mosque', category: 'landmark', tower: 'Parcel 1.09', blurb: 'Award-winning parametric architecture.', visible: true, featured: true },
];

export interface HeroContent {
  headline: string;
  subline: string;
  ctaLabel: string;
}

export const SEED_HERO: HeroContent = {
  headline: 'One district. One app.',
  subline: 'Rides, homes, tables and deliveries — everything KAFD, in your pocket.',
  ctaLabel: 'Explore KAFD ONE',
};
