#!/usr/bin/env node
/**
 * visual-loop.mjs — Automated visual feedback loop using Claude Vision.
 *
 * Runs compare.mjs, reads the pixel diff image, calls Claude API with vision
 * to generate surgical patches, applies them, and repeats until PASS or
 * max iterations. No manual intervention needed.
 *
 * Usage:
 *   node scripts/visual-loop.mjs <original-url> <clone-url> [options]
 *
 * Options:
 *   --threshold N       PASS threshold % (default: 5)
 *   --max-iterations N  max loop cycles (default: 5)
 *   --components-dir P  path to component files (default: src/components/sections)
 *   --model M           Claude model (default: claude-sonnet-4-6)
 *
 * Requires:
 *   ANTHROPIC_API_KEY env var
 *   playwright installed (compare.mjs dependency)
 *
 * Auto-installs @anthropic-ai/sdk if missing.
 *
 * Output:
 *   docs/qa/report.json   updated after each iteration
 *   docs/qa/loop-log.json full iteration log with patches applied
 */

import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// ── Auto-install @anthropic-ai/sdk ───────────────────────────────────────────

function ensureDep(pkg) {
  try {
    _require.resolve(pkg);
  } catch {
    console.log(`Installing ${pkg}...`);
    execFileSync('npm', ['install', '--no-save', pkg], { stdio: 'inherit' });
  }
}

ensureDep('@anthropic-ai/sdk');

const Anthropic = _require('@anthropic-ai/sdk');

// ── Args ─────────────────────────────────────────────────────────────────────

const raw = process.argv.slice(2);

function argVal(flag, defaultVal) {
  const i = raw.indexOf(flag);
  return i !== -1 ? raw[i + 1] : defaultVal;
}

const PASS_THRESHOLD   = Number(argVal('--threshold', '5'));
const MAX_ITERATIONS   = Number(argVal('--max-iterations', '5'));
const COMPONENTS_DIR   = argVal('--components-dir', 'src/components/sections');
const MODEL            = argVal('--model', 'claude-sonnet-4-6');
const positional = raw.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const prev = raw[i - 1];
  if (prev === '--threshold' || prev === '--max-iterations' ||
      prev === '--components-dir' || prev === '--model') return false;
  return true;
});

const [originalUrl, cloneUrl] = positional;

if (!originalUrl || !cloneUrl) {
  console.error('Usage: node scripts/visual-loop.mjs <original-url> <clone-url> [--threshold 5] [--max-iterations 5]');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable not set.');
  console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function runCompare() {
  console.log('  Running compare.mjs...');
  try {
    execFileSync('node', [
      path.join(__dirname, 'compare.mjs'),
      originalUrl,
      cloneUrl,
      '--threshold', String(PASS_THRESHOLD),
    ], { stdio: 'inherit' });
  } catch {
    // compare exits 1 on FAIL — that's expected, continue reading report
  }
  const report = JSON.parse(fs.readFileSync('docs/qa/report.json', 'utf8'));
  return report;
}

function readImageBase64(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath).toString('base64');
}

function loadComponentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const exts = ['.tsx', '.jsx', '.ts', '.js'];
  const files = [];

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (exts.includes(path.extname(entry.name))) {
        const content = fs.readFileSync(full, 'utf8');
        // Skip files >8000 chars to keep token budget sane — Claude needs context, not novels
        if (content.length <= 8000) {
          files.push({ path: full, content });
        } else {
          files.push({ path: full, content: content.slice(0, 8000) + '\n// [truncated — file continues]' });
        }
      }
    }
  }

  walk(dir);
  return files;
}

function loadStylesJson() {
  const p = 'docs/qa/styles.json';
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Trim to essentials to save tokens
    return {
      css_custom_properties: data.css_custom_properties,
      color_palette: (data.color_palette || []).slice(0, 15),
      typography_scale: data.typography_scale,
      spacing_scale: {
        paddings: (data.spacing_scale?.paddings || []).slice(0, 10),
        gaps: (data.spacing_scale?.gaps || []).slice(0, 10),
      },
      border_radius_scale: data.border_radius_scale,
      elements: data.elements,
    };
  } catch {
    return null;
  }
}

function applyPatches(patches) {
  const results = [];
  for (const patch of patches) {
    if (!patch.file || !patch.search || !patch.replace) {
      results.push({ file: patch.file, status: 'skipped', reason: 'missing fields' });
      continue;
    }

    const filePath = patch.file.startsWith('/') ? patch.file : path.join(process.cwd(), patch.file);

    if (!fs.existsSync(filePath)) {
      results.push({ file: patch.file, status: 'skipped', reason: 'file not found' });
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes(patch.search)) {
      // Try normalizing whitespace for a fuzzy match
      results.push({ file: patch.file, status: 'skipped', reason: 'search string not found in file' });
      continue;
    }

    const updated = content.replace(patch.search, patch.replace);
    fs.writeFileSync(filePath, updated, 'utf8');
    results.push({ file: patch.file, status: 'applied', reason: patch.reason || '' });
    console.log(`    patched: ${patch.file} — ${patch.reason || 'no reason given'}`);
  }
  return results;
}

async function callClaude(report, iteration) {
  const componentFiles = loadComponentFiles(COMPONENTS_DIR);
  const stylesData = loadStylesJson();

  // Build vision content blocks
  const content = [];

  // Diff images
  for (const vp of report.viewports) {
    if (vp.verdict === 'PASS') continue;
    const diffB64 = readImageBase64(vp.diff);
    if (diffB64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: diffB64 },
      });
      content.push({
        type: 'text',
        text: `Above: pixel diff for ${vp.viewport} viewport — ${vp.diffPct}% pixels different (${vp.verdict}). Red pixels = visual differences between original and clone.`,
      });
    }
  }

  // Design tokens
  if (stylesData) {
    content.push({
      type: 'text',
      text: `DESIGN TOKENS (exact computed values from the original site):\n${JSON.stringify(stylesData, null, 2)}`,
    });
  }

  // Component files
  if (componentFiles.length > 0) {
    const filesText = componentFiles.map(f =>
      `FILE: ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``
    ).join('\n\n---\n\n');
    content.push({
      type: 'text',
      text: `COMPONENT FILES TO PATCH:\n\n${filesText}`,
    });
  }

  // Also globals.css if exists
  const globalsPath = 'src/app/globals.css';
  if (fs.existsSync(globalsPath)) {
    content.push({
      type: 'text',
      text: `GLOBALS CSS:\nFILE: ${globalsPath}\n\`\`\`css\n${fs.readFileSync(globalsPath, 'utf8').slice(0, 4000)}\n\`\`\``,
    });
  }

  // The ask
  content.push({
    type: 'text',
    text: `
TASK — Iteration ${iteration} of ${MAX_ITERATIONS}

You are a visual diff analyst fixing a website clone. The diff images show red pixels where the clone differs from the original.

Spatial guide for reading the diff image:
- Top 10% = header/nav
- Next 20-35% = hero section
- Middle = feature/pricing/testimonials sections
- Bottom 10% = footer
- Scattered uniform red = systematic issue (font, base color, line-height)
- Column-specific red = grid/flex alignment

Rules:
1. Surgical patches only — no full component rewrites
2. Fix systematic issues first (affects many elements at once)
3. Use exact values from DESIGN TOKENS — never approximate
4. Only patch files listed in COMPONENT FILES
5. Each patch must have a clear visual reason tied to what you see in the diff

Respond with ONLY valid JSON — no markdown, no explanation outside the JSON:

{
  "analysis": "one sentence describing the main visual differences you see",
  "patches": [
    {
      "file": "src/components/sections/Hero.tsx",
      "search": "exact string to find in the file",
      "replace": "replacement string",
      "reason": "what visual issue this fixes and where in the diff image"
    }
  ]
}

If no patches are needed (diff is minimal or unfixable), return: {"analysis": "...", "patches": []}
`,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: 'You are a precise visual diff analyst and React/CSS surgeon. You generate minimal, targeted code patches based on pixel diff images. You always respond with valid JSON only — no markdown code blocks, no prose outside the JSON structure.',
    messages: [{ role: 'user', content }],
  });

  const text = response.content[0]?.text || '{"analysis":"no response","patches":[]}';

  // Strip markdown code blocks if Claude wrapped it anyway
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    console.warn('  Warning: could not parse Claude response as JSON. Raw response saved to docs/qa/claude-raw.txt');
    fs.writeFileSync('docs/qa/claude-raw.txt', text, 'utf8');
    return { analysis: 'parse error', patches: [] };
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

console.log(`\nVisual Loop — ${originalUrl} vs ${cloneUrl}`);
console.log(`Threshold: PASS <${PASS_THRESHOLD}% | Max iterations: ${MAX_ITERATIONS}\n`);

fs.mkdirSync('docs/qa', { recursive: true });

const loopLog = {
  original: originalUrl,
  clone: cloneUrl,
  threshold: PASS_THRESHOLD,
  model: MODEL,
  iterations: [],
};

let report = runCompare();
let prevTotalDiff = Infinity;

const allPass = (r) => r.viewports.every(v => v.verdict === 'PASS');

if (allPass(report)) {
  console.log('\nAll viewports already PASS. Nothing to do.');
  process.exit(0);
}

console.log('\nBaseline:');
for (const vp of report.viewports) {
  const icon = vp.verdict === 'PASS' ? '✓' : vp.verdict === 'WARN' ? '⚠' : '✗';
  console.log(`  ${icon} ${vp.viewport}: ${vp.diffPct}% ${vp.verdict}`);
}

for (let i = 1; i <= MAX_ITERATIONS; i++) {
  console.log(`\n--- Iteration ${i} ---`);

  console.log('  Calling Claude Vision for patch analysis...');
  let result;
  try {
    result = await callClaude(report, i);
  } catch (err) {
    console.error(`  Claude API error: ${err.message}`);
    break;
  }

  console.log(`  Analysis: ${result.analysis}`);
  console.log(`  Patches: ${result.patches.length}`);

  const patchResults = applyPatches(result.patches);

  report = runCompare();

  const totalDiff = report.viewports.reduce((sum, v) => sum + v.diffPct, 0);
  const improvement = prevTotalDiff - totalDiff;

  const iterEntry = {
    iteration: i,
    analysis: result.analysis,
    patchesAttempted: result.patches.length,
    patchResults,
    viewports: report.viewports.map(v => ({
      viewport: v.viewport,
      diffPct: v.diffPct,
      verdict: v.verdict,
    })),
    totalDiff: Math.round(totalDiff * 10) / 10,
    improvement: Math.round(improvement * 10) / 10,
  };

  loopLog.iterations.push(iterEntry);

  console.log(`  Results:`);
  for (const vp of report.viewports) {
    const icon = vp.verdict === 'PASS' ? '✓' : vp.verdict === 'WARN' ? '⚠' : '✗';
    console.log(`    ${icon} ${vp.viewport}: ${vp.diffPct}% ${vp.verdict}`);
  }
  console.log(`  Total diff: ${Math.round(totalDiff * 10) / 10}% (improved ${Math.round(improvement * 10) / 10}%)`);

  if (allPass(report)) {
    console.log('\nAll viewports PASS. Loop complete.');
    break;
  }

  if (improvement < 1 && i > 1) {
    console.log(`\nImprovement < 1% — diminishing returns. Stopping at iteration ${i}.`);
    break;
  }

  prevTotalDiff = totalDiff;
}

// ── Final report ──────────────────────────────────────────────────────────────

fs.writeFileSync('docs/qa/loop-log.json', JSON.stringify(loopLog, null, 2));

console.log('\n=== Visual Loop Summary ===');
if (loopLog.iterations.length === 0) {
  console.log('No iterations ran.');
} else {
  const first = loopLog.iterations[0];
  const last  = loopLog.iterations[loopLog.iterations.length - 1];
  console.log(`Iterations: ${loopLog.iterations.length}`);
  for (const vp of last.viewports) {
    const firstVp = first.viewports.find(v => v.viewport === vp.viewport);
    const icon = vp.verdict === 'PASS' ? '✓' : vp.verdict === 'WARN' ? '⚠' : '✗';
    const start = firstVp ? `${firstVp.diffPct}%` : '?';
    console.log(`  ${icon} ${vp.viewport}: ${start} → ${vp.diffPct}% ${vp.verdict}`);
  }
}
console.log('\nFull log: docs/qa/loop-log.json');
console.log('Diff images: docs/qa/diff-*.png');

const hasFail = report.viewports.some(v => v.verdict === 'FAIL');
if (hasFail) process.exit(1);
