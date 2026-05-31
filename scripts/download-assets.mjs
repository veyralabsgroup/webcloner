#!/usr/bin/env node
/**
 * download-assets.mjs — Download all assets from site-manifest.json to public/
 *
 * Usage:
 *   node scripts/download-assets.mjs docs/site-manifest.json public/
 *
 * Requires: sharp (optional, for WebP conversion)
 *   npm install sharp
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, mkdirSync } from 'fs';

const [,, manifestPath = 'docs/site-manifest.json', outputDir = 'public'] = process.argv;

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const baseUrl = manifest.url;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not installed — skipping WebP conversion (npm install sharp to enable)');
}

function sanitizePath(url, type) {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname).toLowerCase() || '.bin';
    const name = path.basename(u.pathname, ext) || 'asset';
    const safe = name.replace(/[^a-z0-9-_]/gi, '-').slice(0, 60);
    return path.join(outputDir, type, `${safe}${ext}`);
  } catch {
    return null;
  }
}

async function fetchAsset(url) {
  const resolved = url.startsWith('http') ? url : new URL(url, baseUrl).href;
  const res = await fetch(resolved, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebCloner/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${resolved}`);
  return { res, resolved };
}

async function downloadImage(url) {
  const destPath = sanitizePath(url, 'images');
  if (!destPath) return null;

  const ext = path.extname(destPath).toLowerCase();
  const isConvertible = ['.jpg', '.jpeg', '.png'].includes(ext) && sharp;
  const finalPath = isConvertible ? destPath.replace(ext, '.webp') : destPath;

  if (fs.existsSync(finalPath)) return finalPath;
  mkdirSync(path.dirname(finalPath), { recursive: true });

  const { res } = await fetchAsset(url);
  const buffer = Buffer.from(await res.arrayBuffer());

  if (isConvertible) {
    await sharp(buffer).webp({ quality: 85 }).toFile(finalPath);
  } else {
    fs.writeFileSync(finalPath, buffer);
  }

  return finalPath;
}

async function downloadGeneric(url, type) {
  const destPath = sanitizePath(url, type);
  if (!destPath || fs.existsSync(destPath)) return destPath;
  mkdirSync(path.dirname(destPath), { recursive: true });

  const { res } = await fetchAsset(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return destPath;
}

async function batch(items, fn, concurrency = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(fn));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push({ ok: true, path: r.value });
      else results.push({ ok: false, error: r.reason?.message });
    }
  }
  return results;
}

const assets = manifest.assets || {};
const report = { images: [], videos: [], fonts: [], failed: [] };

console.log('Downloading assets...\n');

// Images
if (assets.images?.length) {
  console.log(`Images: ${assets.images.length}`);
  const urls = [...new Set(assets.images.map(i => i.src).filter(Boolean))];
  const results = await batch(urls, downloadImage);
  results.forEach((r, i) => {
    if (r.ok) { report.images.push(r.path); process.stdout.write('.'); }
    else { report.failed.push({ url: urls[i], error: r.error }); process.stdout.write('x'); }
  });
  console.log();
}

// Videos
if (assets.videos?.length) {
  console.log(`\nVideos: ${assets.videos.length}`);
  const urls = [...new Set(assets.videos.map(v => v.src).filter(Boolean))];
  const results = await batch(urls, u => downloadGeneric(u, 'videos'), 2);
  results.forEach((r, i) => {
    if (r.ok) { report.videos.push(r.path); process.stdout.write('.'); }
    else { report.failed.push({ url: urls[i], error: r.error }); process.stdout.write('x'); }
  });
  console.log();
}

// Self-hosted fonts
if (assets.fonts?.length) {
  const selfHosted = assets.fonts.filter(f => !f.includes('googleapis') && !f.includes('typekit'));
  if (selfHosted.length) {
    console.log(`\nFonts (self-hosted): ${selfHosted.length}`);
    const results = await batch(selfHosted, u => downloadGeneric(u, 'fonts'));
    results.forEach((r, i) => {
      if (r.ok) { report.fonts.push(r.path); process.stdout.write('.'); }
      else { report.failed.push({ url: selfHosted[i], error: r.error }); process.stdout.write('x'); }
    });
    console.log();
  }
}

// Write report
const reportPath = 'docs/assets-report.json';
mkdirSync('docs', { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n--- Download Report ---`);
console.log(`Images:  ${report.images.length}`);
console.log(`Videos:  ${report.videos.length}`);
console.log(`Fonts:   ${report.fonts.length}`);
console.log(`Failed:  ${report.failed.length}`);
if (report.failed.length) {
  console.log('\nFailed assets:');
  report.failed.forEach(f => console.log(`  ✗ ${f.url}\n    ${f.error}`));
}
console.log(`\nReport: ${reportPath}`);
