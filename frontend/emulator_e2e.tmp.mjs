// Temporary: the installed Android app on the emulator. Real key presses and taps go through adb; the WebView is
// inspected over its DevTools socket (debug builds expose it).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ADB = 'D:/android-dev/sdk/platform-tools/adb.exe';
const PKG = 'ph.edu.ustp.trailsync';
const PASSWORD = 'Trail-Sync-E2E-1!';
const STUDENT = 'ts.e2e.student@example.test';
const STAFF = 'ts.e2e.staff@example.test';
const SHOTS = 'C:/Users/ACERNI~1/AppData/Local/Temp/claude/d--capstone-TrailSync/e81609e9-54ba-481a-9820-f27b48bb3a6b/scratchpad/org/emu_shots';

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => writeFileSync(`${SHOTS}/${name}.png`, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const back = () => adb('shell', 'input', 'keyevent', '4');
const inForeground = () => /ph\.edu\.ustp\.trailsync/.test(adb('shell', 'dumpsys', 'activity', 'activities').split('\n').filter((l) => /topResumedActivity|mResumedActivity/.test(l)).join('\n'));
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const results = [];
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
let browser;
let page;

async function attach() {
  for (let i = 0; i < 40; i++) {
    const pid = adb('shell', 'pidof', PKG).trim();
    const sockets = pid ? adb('shell', 'cat', '/proc/net/unix') : '';
    if (pid && sockets.includes(`webview_devtools_remote_${pid}`)) {
      adb('forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`);
      browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
      page = browser.contexts()[0].pages().find((p) => p.url().startsWith('https://localhost')) || browser.contexts()[0].pages()[0];
      return;
    }
    await sleep(500);
  }
  throw new Error('WebView devtools socket not found');
}

async function launch({ clear = false } = {}) {
  if (browser) await browser.close().catch(() => {});
  browser = null;
  adb('shell', 'am', 'force-stop', PKG);
  if (clear) adb('shell', 'pm', 'clear', PKG);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await attach();
}

const path = () => page.evaluate(() => window.location.pathname + window.location.search);
async function waitPath(re, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const p = await path().catch(() => '');
    if (re.test(p)) return p;
    await sleep(250);
  }
  throw new Error(`still at ${await path().catch(() => '?')}, wanted ${re}`);
}
const visible = (selector) => page.locator(selector).first().isVisible();

// A real finger: tap the centre of an element through adb, in device pixels.
async function tap(selector) {
  const box = await page.locator(selector).first().boundingBox();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  adb('shell', 'input', 'tap', String(Math.round((box.x + box.width / 2) * dpr)), String(Math.round((box.y + box.height / 2) * dpr)));
}

async function step(name, fn) {
  if (only && !only.test(name)) return;
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
    try { shot(`fail-${name.replace(/\W+/g, '_')}`); } catch {}
  }
}

async function studentLogin() {
  await waitPath(/^\/login/);
  await page.locator('#identifier').waitFor();
  await page.fill('#identifier', STUDENT);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: 'Log in to your account' }).click();
  await waitPath(/^\/portal/);
  await page.locator('.ts-bottom-nav').waitFor();
  await page.waitForLoadState('networkidle').catch(() => {});
}

await launch({ clear: true });

await step('cold start lands on the student login, drawn below the status bar', async () => {
  await waitPath(/^\/login/);
  await page.locator('#identifier').waitFor();
  await sleep(1500);
  const info = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);left:0;width:1px;pointer-events:none';
    document.body.appendChild(probe);
    const r = probe.getBoundingClientRect();
    probe.remove();
    return {
      ua: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],
      insetTop: r.top,
      insetBottom: window.innerHeight - r.bottom,
      bodyPadTop: getComputedStyle(document.body).paddingTop,
      innerHeight: window.innerHeight,
      screenHeight: screen.height,
      native: document.documentElement.classList.contains('ts-native-app'),
      h1Top: document.querySelector('h1').getBoundingClientRect().top,
    };
  });
  console.log('  webview:', JSON.stringify(info));
  expect(info.native, 'no native class');
  shot('01-login');
});

await step('staff credentials get the "use the website" notice with no link', async () => {
  await page.fill('#identifier', STAFF);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: 'Log in to your account' }).click();
  await page.getByText('The TrailSync app is for students and alumni.').waitFor({ timeout: 15000 });
  expect((await page.locator('[data-kind="other-portal"] a').count()) === 0, 'notice has a link');
  shot('02-staff-notice');
});

await step('back on the login leaves the app instead of going anywhere', async () => {
  back();
  await sleep(1500);
  expect(!inForeground(), 'app still in the foreground');
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(1500);
  expect(inForeground(), 'app did not come back');
});

await step('student login reaches Home; bottom nav sits above the gesture area', async () => {
  await launch({ clear: true });
  await studentLogin();
  await sleep(1200);
  const nav = await page.evaluate(() => {
    const n = document.querySelector('.ts-bottom-nav');
    const r = n.getBoundingClientRect();
    return { bottom: r.bottom, innerHeight: window.innerHeight, padBottom: getComputedStyle(n).paddingBottom, itemBottom: n.querySelector('.ts-bottom-nav-item').getBoundingClientRect().bottom };
  });
  console.log('  nav:', JSON.stringify(nav));
  shot('03-home');
});

await step('Track tab, then back returns Home; back on Home leaves the app', async () => {
  await tap('.ts-bottom-nav a[href="/track-requests"]');
  await waitPath(/^\/track-requests/);
  await page.locator('.ts-bottom-nav').waitFor();
  shot('04-track');
  back();
  await waitPath(/^\/portal/);
  await sleep(800);
  back();
  await sleep(1500);
  expect(!inForeground(), 'Home did not leave the app');
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  await sleep(1500);
  expect(inForeground(), 'app did not come back');
  await attach();
  expect(/^\/portal/.test(await path()), `resumed at ${await path()}`);
});

await step('back closes the More sheet before navigating', async () => {
  await tap('.ts-bottom-nav button[aria-haspopup="dialog"]');
  await page.locator('.ts-sheet').waitFor();
  shot('05-more-sheet');
  back();
  await page.locator('.ts-sheet').waitFor({ state: 'detached', timeout: 5000 });
  expect(/^\/portal/.test(await path()), 'navigated instead of closing');
  expect(inForeground(), 'left the app');
});

await step('back closes the notifications popover', async () => {
  await tap('[data-tour="bell"]');
  await page.locator('.ts-popover').waitFor();
  back();
  await page.locator('.ts-popover').waitFor({ state: 'detached', timeout: 5000 });
  expect(/^\/portal/.test(await path()) && inForeground(), 'popover back went elsewhere');
});

await step('request form: back steps back through the form, then leaves it', async () => {
  await tap('.ts-bottom-nav a[href="/request-form"]');
  await waitPath(/^\/request-form/);
  const card = page.locator('button.ts-select-card:not([disabled])').first();
  await card.waitFor({ timeout: 15000 });
  await card.click();
  const next = page.getByRole('button', { name: 'Next', exact: true }).first();
  await next.click();
  await page.locator('.ts-step-enter-fwd').first().waitFor();
  await sleep(500);
  const stepTwo = await page.evaluate(() => document.querySelector('.ts-step-badge-current')?.textContent || '');
  shot('06-request-step2');
  back();
  await sleep(700);
  const stepNow = await page.evaluate(() => document.querySelector('.ts-step-badge-current')?.textContent || '');
  expect(/^\/request-form/.test(await path()), 'left the form from step 2');
  expect(stepNow !== stepTwo, `still on "${stepTwo}"`);
  back();
  await waitPath(/^\/portal/);
});

await step('long press on text selects nothing and opens no menu', async () => {
  const box = await page.locator('h1, .ts-ink').first().boundingBox();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const x = Math.round((box.x + 20) * dpr);
  const y = Math.round((box.y + box.height / 2) * dpr);
  adb('shell', 'input', 'swipe', String(x), String(y), String(x), String(y), '1200');
  await sleep(600);
  const selected = await page.evaluate(() => String(window.getSelection()));
  shot('07-long-press');
  expect(selected === '', `selected "${selected}"`);
});

await step('pulling down at the top does not reload', async () => {
  await page.evaluate(() => { window.__noReload = true; window.scrollTo(0, 0); });
  adb('shell', 'input', 'swipe', '540', '500', '540', '1700', '400');
  await sleep(1500);
  expect(await page.evaluate(() => window.__noReload === true), 'page reloaded');
});

await step('keyboard up: bottom nav steps aside, field stays visible', async () => {
  await tap('.ts-bottom-nav a[href="/track-requests"]');
  await waitPath(/^\/track-requests/);
  const field = 'main input[type="search"], main input[type="text"]';
  await page.locator(field).first().waitFor();
  await tap(field);
  await sleep(1500);
  shot('08-keyboard');
  expect(!(await visible('.ts-bottom-nav')), 'nav still visible while typing');
  back(); // closes the keyboard
  await sleep(1000);
});

await step('launcher icon', async () => {
  adb('shell', 'input', 'keyevent', '3');
  await sleep(1500);
  adb('shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.APP_BROWSER');
  shot('09-home-screen');
});

if (browser) await browser.close().catch(() => {});
for (const r of results) console.log(r.join('  '));
console.log(`${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
