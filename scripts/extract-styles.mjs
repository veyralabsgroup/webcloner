#!/usr/bin/env node
/**
 * extract-styles.mjs — Extract precise computed styles and design tokens via Playwright.
 *
 * Usage:
 *   node scripts/extract-styles.mjs <url> [--out docs/qa/styles.json]
 *
 * Requires: playwright
 *   npm install playwright && npx playwright install chromium
 *
 * Output: JSON with:
 *   - css_custom_properties  — CSS variables from :root
 *   - color_palette          — all unique colors used on page
 *   - typography_scale       — unique font sizes, families, weights, line-heights
 *   - spacing_scale          — unique padding/margin/gap values
 *   - border_radius_scale    — unique border-radius values
 *   - shadow_scale           — unique box-shadow values
 *   - layout_patterns        — grid/flex usage stats
 *   - elements               — computed styles per semantic element type
 *
 * Feed this JSON to Claude in Phase 3 (spec) for pixel-accurate component generation.
 */

import { chromium } from 'playwright';
import fs from 'fs';

const rawArgs = process.argv.slice(2);
const outIdx = rawArgs.indexOf('--out');
const outPath = outIdx !== -1 ? rawArgs[outIdx + 1] : 'docs/qa/styles.json';
const positional = rawArgs.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);
const [url] = positional;

if (!url) {
  console.error('Usage: node scripts/extract-styles.mjs <url> [--out docs/qa/styles.json]');
  process.exit(1);
}

fs.mkdirSync('docs/qa', { recursive: true });

console.log(`Extracting computed styles from ${url}...`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
const page = await context.newPage();

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

const tokens = await page.evaluate(() => {
  // ── Helpers ────────────────────────────────────────────────────────────────

  function unique(arr) {
    return [...new Set(arr.filter(Boolean))];
  }

  function normalizeColor(c) {
    // Skip transparent and none
    if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'none') return null;
    return c.trim();
  }

  function parseNumericPx(val) {
    if (!val || val === '0px' || val === 'none' || val === 'normal') return null;
    return val.trim();
  }

  // ── CSS Custom Properties from :root ──────────────────────────────────────

  const cssCustomProperties = {};
  try {
    const rootStyle = getComputedStyle(document.documentElement);
    // Iterate all stylesheets to find --var declarations
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === 'html') {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                cssCustomProperties[prop] = rootStyle.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }
    // Also scan inline style on :root
    for (const prop of rootStyle) {
      if (prop.startsWith('--')) {
        cssCustomProperties[prop] = rootStyle.getPropertyValue(prop).trim();
      }
    }
  } catch {}

  // ── Semantic element selectors ────────────────────────────────────────────

  const SELECTORS = {
    body:        'body',
    h1:          'h1',
    h2:          'h2',
    h3:          'h3',
    h4:          'h4',
    p:           'p',
    a:           'a',
    button:      'button, [role="button"]',
    input:       'input, textarea, select',
    nav:         'nav',
    header:      'header',
    footer:      'footer',
    section:     'section',
    card:        '[class*="card"], [class*="Card"]',
    badge:       '[class*="badge"], [class*="Badge"], [class*="tag"], [class*="Tag"]',
    code:        'code, pre',
    label:       'label',
    li:          'li',
  };

  const STYLE_KEYS = [
    'color', 'backgroundColor', 'backgroundImage',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'lineHeight', 'letterSpacing', 'textTransform', 'textDecoration',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'gap', 'rowGap', 'columnGap',
    'display', 'flexDirection', 'flexWrap', 'alignItems', 'justifyContent',
    'gridTemplateColumns', 'gridTemplateRows',
    'width', 'maxWidth', 'minWidth', 'height',
    'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'border', 'borderColor', 'borderWidth', 'borderStyle',
    'boxShadow', 'textShadow',
    'opacity', 'transform', 'transition',
    'position', 'zIndex',
  ];

  const elements = {};
  for (const [name, selector] of Object.entries(SELECTORS)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const s = getComputedStyle(el);
    const styles = {};
    for (const key of STYLE_KEYS) {
      const val = s[key];
      if (val && val !== '' && val !== 'auto' && val !== 'normal' && val !== 'none' && val !== '0px') {
        styles[key] = val;
      }
    }
    elements[name] = {
      selector,
      tagName: el.tagName.toLowerCase(),
      classes: el.className,
      styles,
    };
  }

  // ── Global sweeps ─────────────────────────────────────────────────────────

  const allEls = [...document.querySelectorAll(
    'body *:not(script):not(style):not(svg):not(path):not(use)'
  )].slice(0, 800); // cap at 800 elements

  const colors = [];
  const fontSizes = [];
  const fontFamilies = [];
  const fontWeights = [];
  const lineHeights = [];
  const letterSpacings = [];
  const paddings = [];
  const margins = [];
  const gaps = [];
  const borderRadii = [];
  const shadows = [];
  const displays = { flex: 0, grid: 0, block: 0, inline: 0, other: 0 };

  for (const el of allEls) {
    const s = getComputedStyle(el);

    const fg = normalizeColor(s.color);
    const bg = normalizeColor(s.backgroundColor);
    const bc = normalizeColor(s.borderColor);
    if (fg) colors.push(fg);
    if (bg) colors.push(bg);
    if (bc) colors.push(bc);

    const fs = parseNumericPx(s.fontSize);
    if (fs) fontSizes.push(fs);

    const ff = s.fontFamily;
    if (ff) fontFamilies.push(ff.split(',')[0].trim().replace(/['"]/g, ''));

    const fw = s.fontWeight;
    if (fw && fw !== '400') fontWeights.push(fw);

    const lh = parseNumericPx(s.lineHeight);
    if (lh) lineHeights.push(lh);

    const ls = s.letterSpacing;
    if (ls && ls !== '0px') letterSpacings.push(ls);

    const p = s.padding;
    if (p && p !== '0px') paddings.push(p);

    const m = s.margin;
    if (m && m !== '0px') margins.push(m);

    const g = s.gap;
    if (g && g !== 'normal') gaps.push(g);

    const br = s.borderRadius;
    if (br && br !== '0px') borderRadii.push(br);

    const sh = s.boxShadow;
    if (sh && sh !== 'none') shadows.push(sh);

    const disp = s.display;
    if (disp === 'flex') displays.flex++;
    else if (disp === 'grid') displays.grid++;
    else if (disp === 'block') displays.block++;
    else if (disp.includes('inline')) displays.inline++;
    else displays.other++;
  }

  // Sort font sizes numerically
  const sortedFontSizes = unique(fontSizes).sort((a, b) => {
    return parseFloat(a) - parseFloat(b);
  });

  // Count color frequency
  const colorCounts = {};
  for (const c of colors) {
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  }
  const colorPalette = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([color, count]) => ({ color, count }));

  // Layout patterns
  const gridEls = [...document.querySelectorAll('*')].filter(el => {
    return getComputedStyle(el).display === 'grid';
  }).slice(0, 10).map(el => ({
    selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
    gridTemplateColumns: getComputedStyle(el).gridTemplateColumns,
    gap: getComputedStyle(el).gap,
  }));

  const flexEls = [...document.querySelectorAll('*')].filter(el => {
    return getComputedStyle(el).display === 'flex';
  }).slice(0, 10).map(el => ({
    selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
    flexDirection: getComputedStyle(el).flexDirection,
    alignItems: getComputedStyle(el).alignItems,
    justifyContent: getComputedStyle(el).justifyContent,
    gap: getComputedStyle(el).gap,
  }));

  // Meta
  const meta = {
    url: location.href,
    title: document.title,
    totalElements: document.querySelectorAll('*').length,
    scannedElements: allEls.length,
  };

  return {
    meta,
    css_custom_properties: cssCustomProperties,
    color_palette: colorPalette,
    typography_scale: {
      font_sizes: sortedFontSizes,
      font_families: unique(fontFamilies).slice(0, 10),
      font_weights: unique(fontWeights).sort(),
      line_heights: unique(lineHeights).sort((a, b) => parseFloat(a) - parseFloat(b)).slice(0, 15),
      letter_spacings: unique(letterSpacings).slice(0, 10),
    },
    spacing_scale: {
      paddings: unique(paddings).slice(0, 20),
      margins: unique(margins).slice(0, 20),
      gaps: unique(gaps).slice(0, 15),
    },
    border_radius_scale: unique(borderRadii).sort((a, b) => parseFloat(a) - parseFloat(b)).slice(0, 10),
    shadow_scale: unique(shadows).slice(0, 8),
    layout_patterns: {
      display_counts: displays,
      grid_containers: gridEls,
      flex_containers: flexEls,
    },
    elements,
  };
});

await browser.close();

fs.writeFileSync(outPath, JSON.stringify(tokens, null, 2));

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n--- Design Tokens Extracted ---');
console.log(`Colors found:          ${tokens.color_palette.length}`);
console.log(`Font sizes:            ${tokens.typography_scale.font_sizes.length} (${tokens.typography_scale.font_sizes.slice(0, 5).join(', ')}...)`);
console.log(`Font families:         ${tokens.typography_scale.font_families.join(', ')}`);
console.log(`Font weights:          ${tokens.typography_scale.font_weights.join(', ')}`);
console.log(`CSS custom properties: ${Object.keys(tokens.css_custom_properties).length}`);
console.log(`Border radii:          ${tokens.border_radius_scale.join(', ')}`);
console.log(`Shadows:               ${tokens.shadow_scale.length}`);
console.log(`Grid containers:       ${tokens.layout_patterns.grid_containers.length}`);
console.log(`Flex containers:       ${tokens.layout_patterns.flex_containers.length}`);
console.log(`\nOutput: ${outPath}`);

if (Object.keys(tokens.css_custom_properties).length > 0) {
  console.log('\nCSS Custom Properties (design system detected):');
  for (const [k, v] of Object.entries(tokens.css_custom_properties).slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
}

console.log('\nTop colors:');
for (const { color, count } of tokens.color_palette.slice(0, 8)) {
  console.log(`  ${color} (x${count})`);
}
