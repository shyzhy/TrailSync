// Temporary: snapshots every route (DOM + screenshot) so before/after a refactor can be compared.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000';
const PASSWORD = 'Trail-Sync-E2E-1!';
mkdirSync(`${OUT}/dom`, { recursive: true });
mkdirSync(`${OUT}/shots`, { recursive: true });

async function session(email) {
  const res = await fetch(`${API}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.json();
}
const sessions = {
  student: await session('ts.e2e.student@example.test'),
  staff: await session('ts.e2e.staff@example.test'),
  newbie: await session('ts.e2e.new@example.test'),
};

const DESK = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const both = (s) => [
  { ...s, name: `${s.name}-desk`, viewport: DESK },
  { ...s, name: `${s.name}-phone`, viewport: PHONE },
];

const scenarios = [
  ...both({ name: 'landing', path: '/' }),
  ...both({ name: 'login', path: '/login' }),
  ...both({ name: 'staff-login', path: '/registrar/login' }),
  ...both({ name: 'create-account', path: '/create-account' }),
  ...both({ name: 'forgot-student', path: '/forgot-password?from=student' }),
  { name: 'forgot-staff-desk', path: '/forgot-password?from=staff', viewport: DESK },
  { name: 'reset-dead-desk', path: '/reset-password', viewport: DESK },
  { name: 'activate-invalid-desk', path: '/activate', viewport: DESK },
  {
    name: 'login-field-errors-desk', path: '/login', viewport: DESK,
    act: async (p) => p.getByRole('button', { name: 'Log in to your account' }).click(),
  },
  ...both({ name: 'portal', path: '/portal', as: 'student' }),
  ...both({ name: 'request-step1', path: '/request-form', as: 'student' }),
  ...both({ name: 'request-step2', path: '/request-form?transaction_type=6', as: 'student' }),
  ...both({ name: 'track', path: '/track-requests', as: 'student' }),
  ...both({ name: 'track-expanded', path: '/track-requests?search=W6-010', as: 'student' }),
  ...both({ name: 'guide', path: '/credential-guide', as: 'student' }),
  {
    name: 'guide-modal-desk', path: '/credential-guide', as: 'student', viewport: DESK,
    act: async (p) => p.locator('.ts-guide-card').first().click(),
  },
  ...both({ name: 'notifications', path: '/notifications', as: 'student' }),
  ...both({ name: 'profile', path: '/profile', as: 'student' }),
  {
    name: 'bell-open-desk', path: '/portal', as: 'student', viewport: DESK,
    act: async (p) => p.getByRole('button', { name: /^Notifications/ }).click(),
  },
  {
    name: 'more-sheet-phone', path: '/portal', as: 'student', viewport: PHONE,
    act: async (p) => p.getByRole('button', { name: 'More' }).click(),
  },
  { name: 'confirm-email-desk', path: '/confirm-email', as: 'student', viewport: DESK },
  ...both({ name: 'onboarding', path: '/onboarding', as: 'newbie' }),
  ...both({ name: 'staff-dashboard', path: '/registrar/dashboard', as: 'staff' }),
  ...both({ name: 'staff-queue', path: '/registrar/queue', as: 'staff' }),
  ...both({ name: 'staff-review', path: '/registrar/queue/112', as: 'staff' }),
  ...both({ name: 'staff-calendar', path: '/registrar/calendar', as: 'staff' }),
  ...both({ name: 'staff-released', path: '/registrar/released', as: 'staff' }),
  {
    name: 'staff-menu-phone', path: '/registrar/dashboard', as: 'staff', viewport: PHONE,
    act: async (p) => p.getByRole('button', { name: 'Menu' }).click(),
  },
  {
    name: 'error-state-desk', path: '/portal', as: 'student', viewport: DESK,
    before: async (p) => p.route('**/api/dashboard/summary/', (r) => r.abort()),
  },
  {
    name: 'error-boundary-phone', path: '/track-requests', as: 'student', viewport: PHONE,
    before: async (p) =>
      p.route('**/api/form-requests/?*', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, results: [{ id: 1, request_code: { x: 1 }, request_status: 'Submitted', created_at: '2026-01-01' }] }) }),
      ),
  },
];

const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const browser = await chromium.launch();
const consoleLog = {};

function normalize(html) {
  return html
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_, attrs, css) =>
      `<style${attrs.replace(/\s*data-vite-dev-id="[^"]*"/g, '')}>${css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()}</style>`)
    .replace(/\s*data-vite-dev-id="[^"]*"/g, '');
}

for (const s of scenarios) {
  if (ONLY && !ONLY.test(s.name)) continue;
  const context = await browser.newContext({ viewport: s.viewport, timezoneId: 'Asia/Manila', locale: 'en-US', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.clock.setFixedTime(new Date('2026-09-15T02:00:00Z'));
  if (s.as) {
    const data = sessions[s.as];
    await context.addInitScript((d) => {
      localStorage.setItem('trailsync_access_token', d.access);
      localStorage.setItem('trailsync_refresh_token', d.refresh);
      localStorage.setItem('trailsync_user', JSON.stringify(d.user));
    }, data);
  }
  if (s.before) await s.before(page);
  await page.goto(`${APP}${s.path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(900);
  if (s.act) {
    await s.act(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(700);
  }
  const head = await page.evaluate(() => [...document.head.querySelectorAll('style')].map((x) => x.textContent).join('\n'));
  const body = await page.evaluate(() => document.body.outerHTML);
  writeFileSync(`${OUT}/dom/${s.name}.html`, normalize(body));
  writeFileSync(`${OUT}/dom/${s.name}.head.css`, head.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' '));
  await page.screenshot({ path: `${OUT}/shots/${s.name}.png`, fullPage: true });
  consoleLog[s.name] = { url: page.url(), errors };
  await context.close();
  process.stdout.write('.');
}
await browser.close();
writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleLog, null, 1));
console.log(`\n${Object.keys(consoleLog).length} snapshots`);
for (const [name, { url, errors }] of Object.entries(consoleLog)) if (errors.length) console.log(name, url, errors);
