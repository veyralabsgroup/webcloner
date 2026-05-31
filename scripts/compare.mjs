#!/usr/bin/env node
/**
 * compare.mjs — Visual regression: screenshot original vs clone side by side.
 *
 * Usage:
 *   node scripts/compare.mjs <original-url> <clone-url>
 *
 * Requires: playwright
 *   npm install playwright && npx playwright install chromium
 *
 * Output: docs/qa/compare-desktop.png, docs/qa/compare-mobile.png, docs/qa/report.json
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const [,, originalUrl, cloneUrl] = process.argv;

if (!originalUrl || !cloneUrl) {
  console.error('Usage: node scripts/compare.mjs <original-url> <clone-url>');
  process.exit(1);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },
];

fs.mkdirSync('docs/qa', { recursive: true });

const browser = await chromium.launch();
const report = { original: originalUrl, clone: cloneUrl, viewports: [] };

for (const vp of VIEWPORTS) {
  console.log(`Capturing ${vp.name} (${vp.width}x${vp.height})...`);

  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });

  const [pageA, pageB] = await Promise.all([context.newPage(), context.newPage()]);

  await Promise.all([
    pageA.goto(originalUrl, { waitUntil: 'networkidle' }),
    pageB.goto(cloneUrl,    { waitUntil: 'networkidle' }),
  ]);

  await Promise.all([pageA.waitForTimeout(1500), pageB.waitForTimeout(1500)]);

  const [shotA, shotB] = await Promise.all([
    pageA.screenshot({ fullPage: true }),
    pageB.screenshot({ fullPage: true }),
  ]);

  const origPath  = `docs/qa/original-${vp.name}.png`;
  const clonePath = `docs/qa/clone-${vp.name}.png`;
  fs.writeFileSync(origPath,  shotA);
  fs.writeFileSync(clonePath, shotB);

  // Basic size comparison
  const heightDiff = Math.abs(shotA.length - shotB.length);
  const sizePct = Math.round((heightDiff / shotA.length) * 100);

  report.viewports.push({
    viewport: vp.name,
    original: origPath,
    clone: clonePath,
    originalSize: shotA.length,
    cloneSize: shotB.length,
    sizeDiffPct: sizePct,
    note: sizePct > 20 ? 'LARGE DIFF — review manually' : 'within range',
  });

  console.log(`  ✓ ${vp.name}: original=${origPath} clone=${clonePath} diff=${sizePct}%`);
  await context.close();
}

await browser.close();

fs.writeFileSync('docs/qa/report.json', JSON.stringify(report, null, 2));

console.log('\n--- QA Report ---');
for (const vp of report.viewports) {
  const flag = vp.sizeDiffPct > 20 ? '⚠' : '✓';
  console.log(`${flag} ${vp.viewport}: ${vp.note} (${vp.sizeDiffPct}% size diff)`);
}
console.log('\nOpen docs/qa/ to compare screenshots side by side.');
console.log('Full report: docs/qa/report.json');
