/**
 * Headless smoke test for the learn-dbt UI golden path.
 * Uses system Chrome/Edge via playwright-core channels.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:5173/';

async function launch() {
  const channels = ['msedge', 'chrome', 'chromium'];
  for (const channel of channels) {
    try {
      const browser = await chromium.launch({ channel, headless: true });
      return browser;
    } catch {
      // try next channel
    }
  }
  throw new Error('No Chrome/Edge channel available for playwright-core');
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('.brand-mark', { timeout: 15000 });
const brand = await page.textContent('.brand-mark');
console.log('brand:', brand);

async function dismissDialogs() {
  for (let i = 0; i < 3; i++) {
    const startBtn = page.locator('.modal-card button.btn-accent', { hasText: 'Start' });
    if (await startBtn.count()) {
      await startBtn.first().click();
      await page.waitForTimeout(200);
    }
    const closeBtn = page.locator('.modal-head button', { hasText: 'Close' });
    if (await closeBtn.count()) {
      await closeBtn.first().click();
      await page.waitForTimeout(200);
    }
  }
}

await dismissDialogs();

// Open levels and load first intro level
await page.getByRole('button', { name: 'Levels' }).click();
await page.getByRole('button', { name: 'See the graph' }).click();
await dismissDialogs();

// Run dbt ls
await page.fill('#term-input', 'dbt ls');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForTimeout(500);
const logs = await page.locator('.term-logs').innerText();
console.log('--- logs after dbt ls ---');
console.log(logs.slice(0, 500));

if (!logs.includes('stg_orders')) {
  throw new Error('Expected stg_orders in terminal output');
}

// Load a build level and run solution
await page.getByRole('button', { name: 'Levels' }).click();
await page.getByRole('button', { name: 'Build one model' }).click();
await dismissDialogs();
await page.fill('#term-input', 'dbt run --select stg_orders');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForTimeout(600);
const logs2 = await page.locator('.term-logs').innerText();
const banner = await page.locator('.solved-banner').count();
console.log('--- logs after run ---');
console.log(logs2.slice(0, 500));
console.log('solved banner count:', banner);

if (!logs2.includes('OK') && banner === 0) {
  throw new Error('Expected successful run or solved banner');
}

// DAG nodes present
const nodeCount = await page.locator('.dag-node').count();
console.log('dag nodes:', nodeCount);
if (nodeCount < 3) throw new Error('DAG should render multiple nodes');

await page.screenshot({ path: 'output/playwright/learn-dbt-smoke.png', fullPage: true });
console.log('screenshot: output/playwright/learn-dbt-smoke.png');

if (errors.length) {
  console.error('page errors:', errors);
  process.exitCode = 1;
} else {
  console.log('SMOKE OK');
}

await browser.close();
