// Portfolio + walkthrough + CMS engine tests (run: npx tsx scripts/portfolio.test.ts)
import {
  BROKERAGE_CAP,
  DEPOSIT_CAP,
  MIN_LISTING_PHOTOS,
  ROUTE,
  SEED_DIRECTORY,
  SEED_OFFERS,
  SEED_PROPERTIES,
  canList,
  classifyPhoto,
  listingIssues,
  narrationFor,
  offerEffectiveState,
  offerIssues,
  orderPhotos,
  placeholderPhoto,
  walkthroughPlan,
  type Offer,
  type PropertyPhoto,
} from '../src/data/portfolio';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// --- route + classification ---
assert('route has 11 stops in ascending order', ROUTE.length === 11 && ROUTE.every((r, i) => i === 0 || r.order > ROUTE[i - 1].order));
assert('route opens outside and ends on the skyline', ROUTE[0].slot === 'outside' && ROUTE[ROUTE.length - 1].slot === 'final_exterior');
assert('classify kitchen', classifyPhoto('IMG_kitchen_02.jpg') === 'kitchen');
assert('longest keyword wins: bathroom beats bath', classifyPhoto('master-bathroom.jpg') === 'bathroom');
assert('master maps to bedroom when alone', classifyPhoto('master-suite.jpg') === 'bedroom');
assert('terrace maps to patio', classifyPhoto('terrace_view.png') === 'patio');
assert('skyline maps to finale', classifyPhoto('drone-skyline.jpg') === 'final_exterior');
assert('unknown name unclassified', classifyPhoto('DSC_0042.jpg') === null);
assert('classification is case-insensitive', classifyPhoto('LIVING-ROOM.JPG') === 'living');

// --- ordering ---
function ph(id: string, slot: PropertyPhoto['slot']): PropertyPhoto {
  return { id, src: 'data:,x', filename: `${id}.jpg`, slot, slotSource: 'auto' };
}
const scrambled = [ph('a', 'kitchen'), ph('b', 'outside'), ph('c', 'final_exterior'), ph('d', 'living')];
const ordered = orderPhotos(scrambled);
assert('scrambled uploads reorder along the route', ordered.map((p) => p.slot).join(',') === 'outside,living,kitchen,final_exterior');
assert('upload order preserved within a slot', orderPhotos([ph('x1', 'living'), ph('x2', 'living')]).map((p) => p.id).join(',') === 'x1,x2');
const noOpen = orderPhotos([ph('k', 'kitchen'), ph('l', 'living')]);
assert('first photo promoted to outside when tour has no opener', noOpen[0].slot === 'outside' && noOpen[0].id === 'l');
assert('unclassified photos sink to the end', orderPhotos([ph('u', null), ph('o', 'outside')]).map((p) => p.id).join(',') === 'o,u');
assert('empty set stays empty', orderPhotos([]).length === 0);

// --- narration + plan ---
const propRef = { title: 'Vue East 1204', building: 'Vue East', bedrooms: 2 };
assert('narration greets with title and building', narrationFor('outside', propRef).includes('Vue East 1204'));
assert('bedroom narration counts plural bedrooms', narrationFor('bedroom', propRef).includes('2 bedrooms'));
assert('single bedroom reads singular', !narrationFor('bedroom', { ...propRef, bedrooms: 1 }).includes('1 bedrooms'));
const plan = walkthroughPlan(scrambled, propRef);
assert('plan covers every classified photo in route order', plan.map((s) => s.slot).join(',') === 'outside,living,kitchen,final_exterior');
assert('every scene carries camera + narration', plan.every((s) => s.camera.length > 0 && s.narration.length > 0));
assert('opener and finale hold longer', plan[0].seconds === 5 && plan[plan.length - 1].seconds === 5 && plan[1].seconds === 4);
assert('unclassified photos never enter the plan', walkthroughPlan([ph('u', null)], propRef).length === 1); // promoted to outside by orderPhotos

// --- listing compliance ---
const base = SEED_PROPERTIES[0];
assert('seeded flagship lists cleanly', canList(base));
assert('deposit above 5% blocks listing', listingIssues({ ...base, depositSar: base.priceSar * (DEPOSIT_CAP + 0.01) }).some((i) => i.includes('5%')));
assert('brokerage above 2.5% blocks listing', listingIssues({ ...base, brokerageSar: base.priceSar * (BROKERAGE_CAP + 0.01) }).some((i) => i.includes('2.5%')));
assert('missing REGA licence blocks listing', listingIssues({ ...base, regaAdLicense: '' }).some((i) => i.includes('REGA')));
assert('missing FAL licence blocks listing', listingIssues({ ...base, falLicense: ' ' }).some((i) => i.includes('FAL')));
assert('short stay without tourism licence blocked', listingIssues({ ...SEED_PROPERTIES[2], tourismLicense: '' }).some((i) => i.includes('Tourism')));
assert('short stay skips deposit cap (no annual rent)', listingIssues(SEED_PROPERTIES[2]).length === 0);
assert('photo minimum enforced', listingIssues({ ...base, photos: base.photos.slice(0, MIN_LISTING_PHOTOS - 1) }).some((i) => i.includes('photos')));
assert('draft seed is correctly blocked', !canList(SEED_PROPERTIES[4]));
assert('5 seed properties', SEED_PROPERTIES.length === 5);
assert('every seed photo carries a data-uri src', SEED_PROPERTIES.every((p) => p.photos.every((x) => x.src.startsWith('data:'))));
assert('placeholder generator yields svg data uri', placeholderPhoto('living', 'Living').startsWith('data:image/svg+xml'));

// --- offers ---
const offer = SEED_OFFERS[0];
assert('4 seed offers', SEED_OFFERS.length === 4);
assert('valid offer has no issues', offerIssues(offer).length === 0);
assert('61% off is rejected', offerIssues({ ...offer, value: 61 }).some((i) => i.includes('50')));
assert('reversed dates rejected', offerIssues({ ...offer, validFrom: '2026-09-10', validTo: '2026-09-01' }).some((i) => i.includes('End date')));
assert('amount offers skip percent cap', offerIssues({ ...offer, kind: 'amount', value: 200 }).length === 0);
const today = '2026-08-29';
assert('live offer inside window reads live', offerEffectiveState(offer, today) === 'live');
assert('future window reads scheduled', offerEffectiveState({ ...offer, validFrom: '2026-09-15', validTo: '2026-09-22' }, today) === 'scheduled');
assert('past window reads expired', offerEffectiveState({ ...offer, validTo: '2026-03-19', validFrom: '2026-02-17' }, today) === 'expired');
assert('paused wins over the clock', offerEffectiveState({ ...offer, state: 'paused' as Offer['state'] }, today) === 'paused');
assert('draft wins over the clock', offerEffectiveState({ ...offer, state: 'draft' as Offer['state'] }, today) === 'draft');

// --- directory ---
assert('7 directory entries', SEED_DIRECTORY.length === 7);
assert('one hidden entry seeded', SEED_DIRECTORY.filter((d) => !d.visible).length === 1);
assert('featured entries are visible', SEED_DIRECTORY.filter((d) => d.featured).every((d) => d.visible));

console.log(`portfolio: ${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
