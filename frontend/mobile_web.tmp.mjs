// Temporary: the website's auth pages after the shared-code changes, and the student app bundle's routing in a browser.
import { chromium } from 'playwright';

const WEB = 'http://localhost:5173';
const APP = 'http://localhost:4173';
const PASSWORD = 'Trail-Sync-E2E-1!';
const STUDENT = 'ts.e2e.student@example.test';
const STAFF = 'ts.e2e.staff@example.test';
const ADMIN = 'ts.e2e.admin@example.test';
const SHOTS = 'C:/Users/ACERNI~1/AppData/Local/Temp/claude/d--capstone-TrailSync/e81609e9-54ba-481a-9820-f27b48bb3a6b/scratchpad/org/mobile_shots';

const results = [];
const consoleErrors = [];
const EXPECTED = [/Failed to load resource: the server responded with a status of (400|401|403)/];
const browser = await chromium.launch();
const DESK = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

async function step(name, viewport, fn) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport === PHONE, isMobile: viewport === PHONE });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && !EXPECTED.some((re) => re.test(m.text())) && consoleErrors.push(`${name}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => consoleErrors.push(`${name}: pageerror ${e.message}`));
  try {
    await fn(page, context);
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
    await page.screenshot({ path: `${SHOTS}/fail-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}
const see = (page, text, timeout = 10000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function login(page, base, path, identifier, button) {
  await page.goto(`${base}${path}`);
  await page.fill('#identifier', identifier);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: button }).click();
}

// ---------- Website: unchanged behaviour ----------

await step('web: student login keeps its home and Staff Portal links', DESK, async (page) => {
  await page.goto(`${WEB}/login`);
  expect((await page.getByRole('link', { name: /TrailSync home/ }).getAttribute('href')) === '/', 'home link');
  expect((await page.getByRole('link', { name: /Staff Portal login/ }).getAttribute('href')) === '/registrar/login', 'staff link');
  expect(!(await page.evaluate(() => document.documentElement.classList.contains('ts-native-app'))), 'native class on web');
  expect(!(await page.locator('meta[name=viewport]').getAttribute('content')).includes('viewport-fit'), 'viewport-fit on web');
});

await step('web: create account keeps "TrailSync home"', DESK, async (page) => {
  await page.goto(`${WEB}/create-account`);
  expect((await page.getByRole('link', { name: /TrailSync home/ }).getAttribute('href')) === '/', 'home link');
});

await step('web: wrong doors still link to the right portal', DESK, async (page) => {
  await login(page, WEB, '/login', STAFF, 'Log in to your account');
  await see(page, 'This is a staff account');
  expect((await page.getByRole('link', { name: /Go to the Staff Portal login/ }).getAttribute('href')) === '/registrar/login', 'staff link');
  await login(page, WEB, '/registrar/login', STUDENT, 'Log in to Staff Portal');
  await see(page, 'This is a student account');
  expect((await page.getByRole('link', { name: /Go to the student login/ }).getAttribute('href')) === '/login', 'student link');
});

await step('web: student, staff and admin logins land on their dashboards', DESK, async (page) => {
  await login(page, WEB, '/login', STUDENT, 'Log in to your account');
  await page.waitForURL('**/portal');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await login(page, WEB, '/registrar/login', STAFF, 'Log in to Staff Portal');
  await page.waitForURL('**/registrar/dashboard');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await login(page, WEB, '/admin/login', ADMIN, 'Log in to Admin Portal');
  await page.waitForURL('**/admin/dashboard');
});

await step('web: forgot password headers per audience', DESK, async (page) => {
  await page.goto(`${WEB}/forgot-password?from=staff`);
  await see(page, 'TrailSync · Staff Portal');
  await page.goto(`${WEB}/forgot-password?from=admin`);
  await see(page, 'TrailSync · Admin');
  expect((await page.getByRole('link', { name: /Back to login/ }).getAttribute('href')) === '/admin/login', 'admin back link');
});

await step('web: landing page and registrar pages still route', DESK, async (page) => {
  await page.goto(`${WEB}/`);
  await page.locator('.ts-land-navlink, a[href="/login"]').first().waitFor();
  await page.goto(`${WEB}/registrar/login`);
  await see(page, 'Window 6 Staff Portal');
});

// ---------- Student app bundle ----------

await step('app: opens at the student login with no website links', PHONE, async (page) => {
  await page.goto(`${APP}/`);
  await page.waitForURL((u) => u.pathname === '/login');
  await see(page, 'Student & alumni login');
  expect(await page.evaluate(() => document.documentElement.classList.contains('ts-native-app')), 'native class');
  expect((await page.locator('meta[name=viewport]').getAttribute('content')).includes('viewport-fit=cover'), 'viewport-fit');
  expect((await page.title()) === 'TrailSync', `title ${await page.title()}`);
  expect((await page.getByRole('link', { name: /TrailSync home/ }).count()) === 0, 'home link present');
  expect((await page.getByRole('link', { name: /Staff Portal/ }).count()) === 0, 'staff link present');
  expect((await page.locator('a[href^="/registrar"], a[href^="/admin"], a[href="/"]').count()) === 0, 'staff/admin/landing hrefs present');
  await page.screenshot({ path: `${SHOTS}/app-login.png` });
});

await step('app: staff and admin addresses are not pages in the app', PHONE, async (page) => {
  for (const path of ['/registrar/login', '/registrar/dashboard', '/registrar/queue/1', '/admin/login', '/admin/accounts', '/account-setup?uid=x&token=y', '/reset-password?uid=x&token=y', '/activate?token=x', '/nope']) {
    await page.goto(`${APP}${path}`);
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 5000 });
    await see(page, 'Student & alumni login');
  }
});

await step('app: staff and admin credentials get a no-link notice', PHONE, async (page) => {
  await login(page, APP, '/login', STAFF, 'Log in to your account');
  await see(page, 'The TrailSync app is for students and alumni.');
  expect((await page.locator('[data-kind="other-portal"] a').count()) === 0, 'notice has a link');
  await login(page, APP, '/login', ADMIN, 'Log in to your account');
  await see(page, 'Administrators log in to the Admin Portal on the TrailSync website.');
  expect(!(await page.evaluate(() => localStorage.getItem('trailsync_access_token') || sessionStorage.getItem('trailsync_access_token'))), 'staff session saved');
});

await step('app: create account and forgot password stay on student screens', PHONE, async (page) => {
  await page.goto(`${APP}/create-account`);
  expect((await page.getByRole('link', { name: /Back to login/ }).first().getAttribute('href')) === '/login', 'create account back link');
  await page.goto(`${APP}/forgot-password?from=staff`);
  expect((await page.getByText('TrailSync · Staff Portal').count()) === 0, 'staff header in app');
  expect((await page.locator('.ts-scene-staff').count()) === 0, 'staff scene in app');
  expect((await page.getByRole('link', { name: /Back to login/ }).getAttribute('href')) === '/login', 'forgot back link');
});

await step('app: student login, then signed-in addresses go Home', PHONE, async (page) => {
  const apiHosts = new Set();
  page.on('request', (r) => r.url().includes('/api/') && apiHosts.add(new URL(r.url()).host));
  await login(page, APP, '/login', STUDENT, 'Log in to your account');
  await page.waitForURL('**/portal');
  await page.locator('.ts-bottom-nav').waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/app-portal.png` });
  for (const path of ['/', '/registrar/dashboard', '/admin/dashboard']) {
    await page.goto(`${APP}${path}`);
    await page.waitForURL((u) => u.pathname === '/portal', { timeout: 5000 });
  }
  expect([...apiHosts].join() === '127.0.0.1:8000', `api hosts ${[...apiHosts]}`);
});

await step('app: long press and selection are app-like, fields still editable', PHONE, async (page) => {
  await page.goto(`${APP}/login`);
  const blocked = await page.evaluate(() => {
    const fire = (el) => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    return { text: fire(document.querySelector('h1')), input: fire(document.querySelector('#identifier')) };
  });
  expect(blocked.text === true && blocked.input === false, `contextmenu ${JSON.stringify(blocked)}`);
  const select = await page.evaluate(() => ({
    body: getComputedStyle(document.querySelector('h1')).userSelect,
    input: getComputedStyle(document.querySelector('#identifier')).userSelect,
    overscroll: getComputedStyle(document.body).overscrollBehaviorY,
  }));
  expect(select.body === 'none' && select.input === 'text' && select.overscroll === 'none', JSON.stringify(select));
});

await step('app: bottom nav hides while typing', PHONE, async (page) => {
  await login(page, APP, '/login', STUDENT, 'Log in to your account');
  await page.waitForURL('**/portal');
  await page.goto(`${APP}/track-requests`);
  const nav = page.locator('.ts-bottom-nav');
  await nav.waitFor();
  const field = page.locator('main input[type="search"], main input[type="text"]').first();
  await field.waitFor();
  await field.focus();
  expect(!(await nav.isVisible()), 'nav visible while typing');
  await field.blur();
  await nav.waitFor({ state: 'visible' });
});

await browser.close();
for (const r of results) console.log(r.join('  '));
console.log(`${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
console.log(consoleErrors.length ? consoleErrors.join('\n') : 'No unexpected console errors');
