#!/usr/bin/env node
/**
 * compare.mjs — Pixel-accurate visual regression: original vs clone.
 *
 * Usage:
 *   node scripts/compare.mjs <original-url> <clone-url> [--threshold 5]
 *
 * Requires: playwright, pixelmatch, pngjs
 *   npm install playwright pixelmatch pngjs && npx playwright install chromium
 *
 * Auto-installs pixelmatch and pngjs if missing.
 *
 * Output:
 *   docs/qa/original-{viewport}.png  — reference screenshot
 *   docs/qa/clone-{viewport}.png     — clone screenshot
 *   docs/qa/diff-{viewport}.png      — red pixels mark visual differences
 *   docs/qa/report.json              — full results with PASS/WARN/FAIL verdicts
 *
 * Verdicts (default threshold 5%):
 *   PASS  < threshold%  pixels different
 *   WARN  threshold% – 20%
 *   FAIL  > 20%
 *
 * Override threshold:
 *   node scripts/compare.mjs http://a.com http://b.com --threshold 10
 */

import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { chromium } from 'playwright';
import fs from 'fs';

const _require = createRequire(import.meta.url);

function ensureDep(pkg) {
  try {
    _require.resolve(pkg);
  } catch {
    console.log(`Installing ${pkg}...`);
    execFileSync('npm', ['install', '--no-save', pkg], { stdio: 'inherit' });
  }
}

ensureDep('pixelmatch');
ensureDep('pngjs');

const pixelmatch = _require('pixelmatch');
const { PNG } = _require('pngjs');

// Args
const rawArgs = process.argv.slice(2);
const thresholdIdx = rawArgs.indexOf('--threshold');
const PASS_THRESHOLD = thresholdIdx !== -1 ? Number(rawArgs[thresholdIdx + 1]) : 5;
const urls = rawArgs.filter((a, i) => !a.startsWith('--') && i !== thresholdIdx + 1);
const [originalUrl, cloneUrl] = urls;

if (!originalUrl || !cloneUrl) {
  console.error('Usage: node scripts/compare.mjs <original-url> <clone-url> [--threshold 5]');
  process.exit(1);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },
];

fs.mkdirSync('docs/qa', { recursive: true });

// Crop RGBA buffer to targetWidth x targetHeight (top-left region)
function cropRGBA(png, targetWidth, targetHeight) {
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) {
    const srcStart = y * png.width * 4;
    const dstStart = y * targetWidth * 4;
    png.data.copy(out, dstStart, srcStart, srcStart + targetWidth * 4);
  }
  return out;
}

function verdict(pct) {
  if (pct <= PASS_THRESHOLD) return 'PASS';
  if (pct <= 20) return 'WARN';
  return 'FAIL';
}

const browser = await chromium.launch();
const report = {
  original: originalUrl,
  clone: cloneUrl,
  threshold: PASS_THRESHOLD,
  viewports: [],
};

for (const vp of VIEWPORTS) {
  console.log(`\nCapturing ${vp.name} (${vp.width}x${vp.height})...`);

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
  const diffPath  = `docs/qa/diff-${vp.name}.png`;

  fs.writeFileSync(origPath,  shotA);
  fs.writeFileSync(clonePath, shotB);

  const imgA = PNG.sync.read(shotA);
  const imgB = PNG.sync.read(shotB);

  const cmpWidth  = Math.min(imgA.width,  imgB.width);
  const cmpHeight = Math.min(imgA.height, imgB.height);

  const dataA = (imgA.width === cmpWidth && imgA.height === cmpHeight)
    ? imgA.data
    : cropRGBA(imgA, cmpWidth, cmpHeight);

  const dataB = (imgB.width === cmpWidth && imgB.height === cmpHeight)
    ? imgB.data
    : cropRGBA(imgB, cmpWidth, cmpHeight);

  const diffPNG = new PNG({ width: cmpWidth, height: cmpHeight });

  const numDiff = pixelmatch(dataA, dataB, diffPNG.data, cmpWidth, cmpHeight, {
    threshold: 0.1,
    includeAA: false,
  });

  fs.writeFileSync(diffPath, PNG.sync.write(diffPNG));

  const totalPixels = cmpWidth * cmpHeight;
  const diffPct     = Math.round((numDiff / totalPixels) * 1000) / 10;
  const v           = verdict(diffPct);

  const sizeMismatch =
    imgA.width !== imgB.width || imgA.height !== imgB.height;

  const entry = {
    viewport: vp.name,
    verdict: v,
    diffPct,
    numDiffPixels: numDiff,
    totalPixels,
    original: origPath,
    clone: clonePath,
    diff: diffPath,
    originalDimensions: `${imgA.width}x${imgA.height}`,
    cloneDimensions:    `${imgB.width}x${imgB.height}`,
  };

  if (sizeMismatch) {
    entry.note = `size mismatch — compared top ${cmpWidth}x${cmpHeight} region`;
  }

  report.viewports.push(entry);

  const icon = v === 'PASS' ? '✓' : v === 'WARN' ? '⚠' : '✗';
  console.log(`  ${icon} ${vp.name}: ${v} — ${diffPct}% pixels different (${numDiff.toLocaleString()} / ${totalPixels.toLocaleString()})`);
  if (sizeMismatch) {
    console.log(`    note: ${entry.note}`);
  }

  await context.close();
}

await browser.close();

fs.writeFileSync('docs/qa/report.json', JSON.stringify(report, null, 2));

console.log('\n--- QA Report ---');
for (const vp of report.viewports) {
  const icon = vp.verdict === 'PASS' ? '✓' : vp.verdict === 'WARN' ? '⚠' : '✗';
  console.log(`${icon} ${vp.viewport}: ${vp.verdict} — ${vp.diffPct}% diff`);
}
console.log(`\nThreshold: PASS <${PASS_THRESHOLD}% | WARN ${PASS_THRESHOLD}%–20% | FAIL >20%`);
console.log('Diff images (red = changed pixels): docs/qa/diff-*.png');
console.log('Full report: docs/qa/report.json');

const hasFail = report.viewports.some(v => v.verdict === 'FAIL');
if (hasFail) process.exit(1);
