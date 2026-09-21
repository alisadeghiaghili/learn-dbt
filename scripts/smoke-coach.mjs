import { chromium } from 'playwright-core';

const url = process.argv[2] || 'https://alisadeghiaghili.github.io/learn-dbt/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('.brand-mark');

async function dismiss() {
  for (let i = 0; i < 3; i++) {
    const b = page.locator('.modal-card button.btn-accent', { hasText: 'Start' });
    if (await b.count()) await b.first().click();
    const c = page.locator('.modal-head button', { hasText: 'Close' });
    if (await c.count()) await c.first().click();
  }
}

await dismiss();
await page.getByRole('button', { name: 'Levels' }).click();
await page.getByRole('button', { name: 'Plus means upstream' }).click();
await dismiss();

const checklist = await page.locator('.sol-steps').innerText();
console.log('checklist:\n' + checklist);
if (!checklist.includes('dbt run --select +fct_orders')) {
  throw new Error('Goal checklist missing official solution command');
}

// wrong command → Next coach
await page.fill('#term-input', 'dbt run --select fct_orders');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForTimeout(400);
const logs = await page.locator('.term-logs').innerText();
console.log('--- logs ---\n' + logs.slice(0, 600));
if (!logs.includes('Next: dbt run --select +fct_orders') && !logs.includes('Official step')) {
  throw new Error('Expected Next coach line after wrong command');
}

// steps meta
await page.fill('#term-input', 'steps');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForTimeout(300);
const logs2 = await page.locator('.term-logs').innerText();
if (!logs2.includes('dbt run --select +fct_orders')) {
  throw new Error('steps command should list official solution');
}

await page.screenshot({ path: 'output/playwright/learn-dbt-coach.png', fullPage: true });
console.log('COACH SMOKE OK');
await browser.close();
