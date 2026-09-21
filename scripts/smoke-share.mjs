import { chromium } from 'playwright-core';

const url = process.argv[2] || 'https://alisadeghiaghili.github.io/learn-dbt/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'level=intro_run_one', {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await page.waitForSelector('.brand-mark');

async function dismiss() {
  for (let i = 0; i < 3; i++) {
    const b = page.locator('.modal-card button.btn-accent', { hasText: 'Start' });
    if (await b.count()) await b.first().click();
  }
}
await dismiss();

await page.fill('#term-input', 'dbt run --select stg_orders');
await page.getByRole('button', { name: 'Run' }).click();
await page.waitForSelector('.solved-modal', { timeout: 5000 });
const modal = await page.locator('.solved-card').innerText();
const modalLc = modal.toLowerCase();
console.log(modal);
for (const needle of ['level solved', 'build one model', 'linkedin', 'x / twitter', 'facebook', 'copy link', 'next level']) {
  if (!modalLc.includes(needle)) throw new Error(`missing in dialog: ${needle}`);
}
const li = await page.locator('a.share-li').getAttribute('href');
const tw = await page.locator('a.share-x').getAttribute('href');
const fb = await page.locator('a.share-fb').getAttribute('href');
if (!li?.includes('linkedin.com')) throw new Error('bad LinkedIn href');
if (!tw?.includes('twitter.com') && !tw?.includes('x.com')) throw new Error('bad X href');
if (!fb?.includes('facebook.com')) throw new Error('bad Facebook href');
console.log('linkedin', li);
console.log('twitter', tw);
console.log('facebook', fb);
await page.screenshot({ path: 'output/playwright/learn-dbt-solved-share.png', fullPage: true });
console.log('CELEBRATION SMOKE OK');
await browser.close();
