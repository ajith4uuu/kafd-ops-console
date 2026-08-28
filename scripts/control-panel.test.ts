// Control Panel (IAM/governance) seed + analytics tests
// (run: npx tsx scripts/control-panel.test.ts)
import { controlKpis, financeControlKpis, sodViolations } from '../src/data/analytics';
import {
  ACCESS_REQUESTS,
  ACCESS_REVIEW,
  ADMINS,
  APPROVAL_LIMITS,
  FINANCE_QUEUE,
  OFFBOARDING_CASES,
  PERMISSIONS,
  ROLE_CATALOG,
  SOD_FORBIDDEN,
} from '../src/data/seed';

let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

// --- role catalog integrity ---
assert('9 roles in catalog', ROLE_CATALOG.length === 9);
assert('16 permissions defined', PERMISSIONS.length === 16);
assert('every role permission exists in the catalog', ROLE_CATALOG.every((r) => r.permissions.every((p) => PERMISSIONS.some((x) => x.id === p))));
assert('super admin holds every permission', ROLE_CATALOG.find((r) => r.id === 'super_admin')!.permissions.length === PERMISSIONS.length);
assert('super admin capped at 3', ROLE_CATALOG.find((r) => r.id === 'super_admin')!.maxHolders === 3);
assert('auditor is read-only', ROLE_CATALOG.find((r) => r.id === 'auditor')!.permissions.every((p) => ['view_dashboards', 'view_audit', 'export_data'].includes(p)));
assert('analyst cannot touch money or users', ROLE_CATALOG.find((r) => r.id === 'ops_analyst')!.permissions.every((p) => !p.includes('payout') && !p.includes('refund') && p !== 'manage_users'));

// --- SoD: the catalog itself is conflict-free ---
for (const role of ROLE_CATALOG.filter((r) => r.id !== 'super_admin')) {
  assert(`role ${role.id} holds no forbidden pair`, SOD_FORBIDDEN.every(([a, b]) => !(role.permissions.includes(a) && role.permissions.includes(b))));
}
assert('maker cannot approve (roles disjoint)', !ROLE_CATALOG.find((r) => r.id === 'finance_maker')!.permissions.includes('approve_payout'));
assert('checker cannot prepare', !ROLE_CATALOG.find((r) => r.id === 'finance_checker')!.permissions.includes('prepare_payout'));
assert('live directory has zero SoD violations', sodViolations().length === 0);

// --- admin directory ---
assert('18 admins seeded', ADMINS.length === 18);
assert('exactly 2 super admins (under cap)', ADMINS.filter((a) => a.role === 'super_admin').length === 2);
assert('every division has at least one admin', ['platform', 'mobility', 'property', 'hospitality', 'estate', 'finance', 'people', 'security'].every((d) => ADMINS.some((a) => a.division === d)));
assert('all super admins have MFA + Nafath', ADMINS.filter((a) => a.role === 'super_admin').every((a) => a.mfa && a.nafathVerified));
assert('one invited admin', ADMINS.filter((a) => a.status === 'invited').length === 1);

// --- governance KPIs ---
const k = controlKpis();
assert('kpi admins matches directory', k.admins === 18);
assert('mfa pct between 0 and 100', k.mfaPct > 0 && k.mfaPct <= 100);
assert('two stale accounts flagged', k.stale === 2);
assert('review pct matches campaign', k.reviewPct === Math.round((ACCESS_REVIEW.reduce((s, r) => s + r.reviewed, 0) / ACCESS_REVIEW.reduce((s, r) => s + r.total, 0)) * 1000) / 10);
assert('two review revocations', k.reviewRevoked === 2);
assert('pending requests counted', k.pendingRequests === ACCESS_REQUESTS.length);

// --- lifecycle ---
assert('requests cover joiner, mover and leaver', (['joiner', 'mover', 'leaver'] as const).every((kind) => ACCESS_REQUESTS.some((r) => r.kind === kind)));
assert('requester never approves own request (four-eyes data)', ACCESS_REQUESTS.every((r) => r.requestedBy !== r.person));
assert('offboarding cases carry 6 steps', OFFBOARDING_CASES.every((c) => c.steps.length === 6));
assert('sessions revoked first in every case', OFFBOARDING_CASES.every((c) => c.steps[0].step.startsWith('Revoke SSO') && c.steps[0].done));
assert('one offboarding fully closed', OFFBOARDING_CASES.some((c) => c.steps.every((s) => s.done)));
assert('review campaign covers all 8 divisions', ACCESS_REVIEW.length === 8);

// --- finance dual control ---
const fk = financeControlKpis();
assert('4 pending approvals', fk.pendingCount === 4);
assert('pending value sums queue', fk.pendingValue === FINANCE_QUEUE.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amountSar, 0));
assert('decided items are 100% dual-controlled', fk.dualControlPct === 100);
assert('no decided item self-approved', FINANCE_QUEUE.filter((f) => f.status !== 'pending').every((f) => f.checker !== f.maker));
assert('one item above checker limit', fk.overLimit === 1);
assert('the over-limit item is the 112k payout', FINANCE_QUEUE.find((f) => f.amountSar > 100000)!.ref === 'PAY-2026-0822');
assert('limits ascend with role seniority', APPROVAL_LIMITS.find((l) => l.role === 'super_admin')!.limitSar > APPROVAL_LIMITS.find((l) => l.role === 'finance_checker')!.limitSar);

console.log(`control-panel: ${passed} passed, ${failed} failed`);
declare const process: { exit(code: number): never };
if (failed > 0) process.exit(1);
