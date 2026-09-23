import { chromium } from 'playwright-core';

const url = process.argv[2] || 'https://alisadeghiaghili.github.io/learn-dbt/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'level=intro_run_one&x=' + Date.now(), {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await page.waitForSelector('.brand-mark');
const start = page.locator('.modal-card button.btn-accent', { hasText: 'Start' });
if (await start.count()) await start.first().click();

await page.fill('#term-input', 'dbt run --select stg_orders');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForSelector('.solved-modal.is-party', { timeout: 5000 });
await page.waitForSelector('.confetti-canvas', { timeout: 3000 });
await page.waitForSelector('.party-badge', { timeout: 3000 });
await page.waitForSelector('.canvas-panel.is-celebrating', { timeout: 3000 });
const partyNodes = await page.locator('.dag-node.is-party').count();
const card = await page.locator('.solved-card').getAttribute('class');
console.log('card class:', card);
console.log('party dag nodes:', partyNodes);
if (partyNodes < 1) throw new Error('expected at least one celebrating DAG node');
const modalText = (await page.locator('.solved-card').innerText()).toLowerCase();
if (!modalText.includes('you did it')) throw new Error('missing celebration kicker');
if (!modalText.includes('share the win')) throw new Error('missing share block');
await page.waitForTimeout(800);
await page.screenshot({ path: 'output/playwright/learn-dbt-party.png', fullPage: true });
console.log('PARTY SMOKE OK');
await browser.close();
