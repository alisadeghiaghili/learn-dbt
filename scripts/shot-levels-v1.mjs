import { chromium } from 'playwright-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = path.resolve('output/levels-v1-preview.html');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await page.goto(pathToFileURL(file).href);
await page.screenshot({ path: 'output/playwright/levels-list-v1.png', fullPage: true });
console.log('ok', path.resolve('output/playwright/levels-list-v1.png'));
await browser.close();
