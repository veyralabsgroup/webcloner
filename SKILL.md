---
name: webcloner
description: >
  Website Cloner. Activate when a user wants to clone, replicate, or rebuild a website's visual design.
  Triggers on: "clone this website", "replicate this landing page", "rebuild this design in Next.js",
  "copy the layout of this site", "I want my site to look like X", "recreate this homepage".
  Designed for landings, marketing sites, portfolios, and ecommerce storefronts — not web applications,
  dashboards, or SaaS products with auth flows. Produces a pixel-accurate clone using spec-driven
  parallel construction with automated extraction.
---

# WebCloner — Website Visual Cloning

You are a senior front-end engineer and design systems expert. Your job is to produce a pixel-accurate
visual clone of a target website — not a content copy, a visual clone. Same layout, same spacing,
same typography, same interactions, same feel.

Most cloning attempts fail at 80% because they guess at interactions, miss assets, or skip the
extraction phase. This skill forces the right order: extract first, build second, QA third.

## Scope — What This Skill Handles

**In scope:**
- Landing pages
- Marketing sites
- Portfolio sites
- Ecommerce storefronts (product listings, product pages, cart)
- Single-page promotional sites
- Agency / studio sites

**Out of scope (do not attempt):**
- SaaS dashboards or admin panels
- Web apps with authentication flows
- Sites with heavy real-time data (live prices, feeds, WebSockets)
- Full ecommerce checkout + payment flows
- Anything requiring server-side business logic to render

If the target is out of scope, say so immediately and explain why. Don't attempt a partial clone
that will fail half-way through.

---

## Prerequisites

Before starting, verify these are available:

```bash
# Python 3.10+ with Scrapling
pip install scrapling
scrapling install  # installs Playwright browsers

# Node 18+
node --version

# Check if Chrome MCP is available in this session
```

If Scrapling is not installed, offer the manual extraction fallback (see `references/manual-fallback.md`).

---

## Mode Selection

Ask the user which mode they need, or infer from context:

| Mode | When to use |
|------|-------------|
| `inspect` | "What would it take to clone this?" — analysis only, no files created |
| `spec` | Extract everything, produce spec files, no code written yet |
| `build` | Build from an existing spec (offline, no target URL needed) |
| `clone` | Full end-to-end: inspect → spec → build → QA |
| `update` | A section of an existing clone needs refreshing |

Default when user gives a URL with no other context: **`clone` mode**.

---

## Phase 1 — Reconnaissance (`inspect` + start of `clone`)

**Goal:** Understand the site completely before touching any code.

### 1.1 — Initial fetch with Scrapling

Run `scripts/extract.py` with the target URL:

```bash
python scripts/extract.py <url> --output docs/site-manifest.json
```

This produces `docs/site-manifest.json` with:
- Tech stack detection (framework, CSS library, animation libraries)
- DOM structure (sections, components, hierarchy)
- Computed CSS for every visible element
- Asset inventory (images, videos, fonts, SVGs)
- Color palette extracted from computed styles
- Typography system (font families, sizes, weights, line heights)
- Detected breakpoints
- Animation library signatures

### 1.2 — Extract computed styles and design tokens

Run `scripts/extract-styles.mjs` to capture exact CSS values post-cascade — not raw CSS text, but the final computed values the browser actually applies:

```bash
node scripts/extract-styles.mjs <url> --out docs/qa/styles.json
```

This produces `docs/qa/styles.json` with:
- **CSS custom properties** from `:root` (design system variables if the site uses them)
- **Color palette** — all unique colors ranked by frequency (background, text, border)
- **Typography scale** — exact font sizes in px, families, weights, line-heights
- **Spacing scale** — exact padding, margin, gap values used across the page
- **Border radius scale** — all unique radii
- **Shadow scale** — all unique box-shadow values
- **Layout patterns** — grid-template-columns per container, flex configs
- **Per-element computed styles** — h1, h2, p, button, nav, header, footer with every layout property

Feed `docs/qa/styles.json` into Phase 3 specs instead of guessing values. These are the numbers the browser computed — not what the stylesheet says, but what renders.

### 1.3 — Take screenshots

Using Chrome MCP or Playwright:

```javascript
// Desktop (1440px)
await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });

// Tablet (768px)
await page.setViewportSize({ width: 768, height: 1024 });
await page.screenshot({ path: 'docs/screenshots/tablet.png', fullPage: true });

// Mobile (390px)
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
```

### 1.3 — Interaction sweep

Manually (or via Playwright) perform:

1. **Scroll sweep** — Scroll entire page top to bottom. Watch for:
   - Header changes (shrink, color change, blur)
   - Elements appearing on scroll (fade-in, slide-in)
   - Parallax movement
   - Scroll-snap sections
   - Sticky elements (nav, CTA bars)
   - Progress bars

2. **Click sweep** — Click every interactive element:
   - Navigation links (does it SPA-navigate or hard reload?)
   - Tabs, accordions, carousels
   - Modals, drawers, tooltips
   - CTAs (destination + any animation)

3. **Hover sweep** — Hover over:
   - Navigation items (dropdowns, underlines, color shifts)
   - Cards and buttons (shadow, scale, color changes)
   - Images (zoom, overlay)

4. **Responsive sweep** — At 1440, 1024, 768, 390:
   - What reflows? (columns → stack, desktop nav → hamburger)
   - What disappears? (decorative elements, sidebar)
   - What changes size? (typography scale, spacing)

### 1.4 — Animation library detection

From the manifest + manual inspection:

```javascript
// Check for GSAP
window.gsap !== undefined
window.ScrollTrigger !== undefined

// Check for Framer Motion
document.querySelector('[data-framer-appear]') !== null
// or look for motion-* classes in React components

// Check for Lenis smooth scroll
window.lenis !== undefined
document.documentElement.classList.contains('lenis')

// Check for AOS
document.querySelector('[data-aos]') !== null

// Check for custom CSS animations
// Look in stylesheets for @keyframes
```

Document findings in `docs/site-manifest.json` → `animations` section.

### 1.5 — Write reconnaissance summary

Create `docs/RECON.md`:

```markdown
# Reconnaissance — [Site Name]

## Tech Stack
- Framework detected: [React/Vue/static/Webflow/etc.]
- CSS: [Tailwind/custom/styled-components/etc.]
- Animation: [GSAP/Framer Motion/Lenis/CSS only/none]
- Font delivery: [Google Fonts/Adobe/self-hosted/variable]

## Page Structure
[List of sections top to bottom with estimated complexity]
1. Header/Nav — sticky, shrinks on scroll
2. Hero — full-viewport, parallax background, Lenis scroll
3. Features — 3-column grid, tab-switch behavior
...

## Key Behaviors
[The 3-5 most complex interactions that could break the clone]
- Header: transitions from transparent to white at 80px scroll
- Features: tabs switch on click, NOT on scroll
- ...

## Complexity Assessment
- Total sections: N
- Sections with complex behavior: N
- Animation library: [name or "none"]
- Estimated build time: [X-Y hours]

## Interaction Model Decisions
⚠️ MUST decide before building:
- [ ] Features section: scroll-driven or click-driven? → [ANSWER]
- [ ] Hero animation: CSS or JS? → [ANSWER]
```

**Do not start building until RECON.md is complete and reviewed.**

---

## Phase 2 — Foundation

**Goal:** Set up the target project and apply global styles before any components.

### 2.1 — Project setup

If no target project exists:

```bash
npx create-next-app@latest clone --typescript --tailwind --app --src-dir --import-alias "@/*"
cd clone
npx shadcn@latest init
```

### 2.2 — Apply global tokens from manifest

From `docs/qa/styles.json` (computed styles — prefer these over manifest for exact values) and `docs/site-manifest.json`:

**Fonts** — update `app/layout.tsx`:
```typescript
// Use next/font for self-hosted or Google Fonts
// Match exact weights and subsets detected in manifest
```

**Colors** — update `app/globals.css`:
```css
:root {
  /* Exact values from manifest → colorPalette */
  --color-bg: [value];
  --color-text: [value];
  /* ... */
}
```

**Typography scale** — add to `globals.css`:
```css
/* Match exact font-size, line-height, letter-spacing from manifest */
```

**Keyframe animations** — add any `@keyframes` detected in the original.

**Scroll behavior** — if Lenis detected:
```bash
npm install lenis
```
Create `src/components/LenisProvider.tsx` matching original config.

**If GSAP detected:**
```bash
npm install gsap
```

**If Framer Motion detected:**
```bash
npm install framer-motion
```

### 2.3 — Download all assets

```bash
node scripts/download-assets.mjs docs/site-manifest.json public/
```

This downloads all images, videos, and self-hosted fonts to `public/` and converts raster images to WebP.

Verify the download report — any failed assets must be resolved before building components.

### 2.4 — Extract SVGs

From the manifest `assets.svgs` array, create `src/components/icons.tsx` with all inline SVGs,
deduplicated by content hash.

### 2.5 — Verify build passes

```bash
npm run build
```

Zero errors before any component work. Fix TypeScript config issues now.

---

## Phase 3 — Component Specification

**Goal:** Produce a complete spec for each section before dispatching any builder agent.

### 3.1 — Component boundary detection

From `docs/site-manifest.json` → `sections`, identify boundaries:

**Heuristics:**
- Full-width containers with distinct background = new section
- Repeated structure (cards, features) = one component with props
- Navigation + header = one component
- Footer = one component
- Modal/overlay = one component, separate from trigger

Common mistake: splitting one logical component into many because the DOM is deeply nested.
If a section has sub-elements that only appear together, it's one component.

### 3.2 — Write spec file for each section

For each section, create `docs/specs/[section-name].spec.md`:

```markdown
# [Section Name] — Spec

## Screenshot
[attach section screenshot from docs/screenshots/desktop.png — crop]

## DOM Structure
[describe exact HTML structure — tag names, nesting, text content verbatim]

## Computed Styles
[from docs/qa/styles.json → elements — exact post-cascade values, not raw CSS]
- Container: max-width: 1200px, padding: 0 80px, background: #fff
- Headline: font-size: 64px, font-weight: 700, line-height: 1.1, letter-spacing: -0.02em
- ...

## Responsive Behavior
| Breakpoint | Changes |
|------------|---------|
| 1440px | [baseline] |
| 1024px | [what changes] |
| 768px | [what changes] |
| 390px | [what changes] |

## States & Behaviors
[Structured YAML — see references/behavior-spec-format.md]

behaviors:
  - name: "Tab switch"
    trigger:
      type: click
      selector: ".tab-button"
    states:
      default:
        content: [tab 1 content]
        activeTab: 0
      tab-2:
        content: [tab 2 content]
        activeTab: 1
    transition:
      duration: 200ms
      easing: ease-out

## Assets Used
- Hero background: public/images/hero-bg.webp
- Feature icon 1: public/images/icon-speed.svg
- ...

## Content (verbatim)
[Copy exact text from the site — do not paraphrase]
```

**Spec quality checklist before dispatch:**
- [ ] Screenshot attached or referenced
- [ ] DOM structure described (not guessed)
- [ ] All text content is verbatim (not paraphrased)
- [ ] All states listed (hover, active, each tab, each accordion item)
- [ ] Responsive behavior documented at all 4 breakpoints
- [ ] Assets reference downloaded files in `public/`, not original URLs
- [ ] Interaction model decided (scroll-driven vs click-driven)
- [ ] Behavior spec is YAML, not prose

---

## Phase 4 — Parallel Build

**Goal:** Build each section simultaneously using git worktrees.

### 4.1 — Dispatch builder agents

For each spec file, create a worktree and dispatch a builder agent:

```bash
git worktree add ../clone-[section] -b build/[section]
```

Each agent receives:
1. The full spec file content (inlined in the prompt)
2. The target stack (Next.js + TypeScript + Tailwind v4 + shadcn)
3. This constraint set:
   - Match computed CSS values exactly — no approximations
   - Use downloaded assets in `public/` — no external URLs
   - Export a single typed component with all content as props
   - Must pass `npm run build` before reporting done
   - Test at 1440, 768, 390 by resizing the browser
   - Implement ALL states listed in the spec

### 4.2 — Builder agent prompt template

```
Build the [SectionName] component for a website clone.

SPEC:
[paste full spec content]

CONSTRAINTS:
- Stack: Next.js 15, TypeScript strict, Tailwind v4, shadcn/ui
- Assets: already downloaded to public/ — use Next.js Image or <img> with these paths
- Typography: global font tokens already set in globals.css — reference CSS variables
- Animation library available: [name or "none"]
- Match every CSS value in the spec exactly
- All text is verbatim from the spec — do not alter copy

OUTPUT:
- src/components/sections/[SectionName].tsx
- Must compile with zero TypeScript errors
- Must render at 1440, 768, 390 without horizontal overflow

Report: what was built, any deviations from spec (reason required), build status.
```

### 4.3 — Merge sequence

Merge worktrees one at a time, top to bottom (page order):

```bash
git merge build/[section] --no-ff
npm run build  # verify after each merge
```

Fix any TypeScript conflicts before merging the next worktree.

---

## Phase 5 — Assembly

**Goal:** Wire all components into the final page layout.

### 5.1 — Update `src/app/page.tsx`

```typescript
import Hero from '@/components/sections/Hero'
import Features from '@/components/sections/Features'
// ... all sections

export default function Page() {
  return (
    <main>
      <Hero />
      <Features />
      {/* ... in DOM order from original */}
    </main>
  )
}
```

### 5.2 — Implement page-level behaviors

Things that span multiple sections — implement in layout, not in individual components:

- **Sticky header** with scroll-triggered style changes
- **Smooth scroll provider** (Lenis wrap around everything)
- **GSAP ScrollTrigger context** (if used)
- **Dark/light transitions** that span sections
- **Scroll progress indicators**

### 5.3 — Final asset pass

Check `public/` — every file referenced in components must exist.
Replace any remaining external URLs with local paths.

---

## Phase 6 — Visual QA

**Goal:** Find and fix all deviations before declaring done.

### 6.1 — Side-by-side comparison

```bash
node scripts/compare.mjs <original-url> http://localhost:3000
```

This captures screenshots of both at 1440 and 390, outputs a diff report.

### 6.2 — Manual QA checklist

**Visual:**
- [ ] Typography matches (font, size, weight, line-height, letter-spacing)
- [ ] Colors match (backgrounds, text, borders, shadows)
- [ ] Spacing matches (padding, margins, gaps)
- [ ] Images load and are the right size/ratio
- [ ] Icons render correctly (SVGs, icon fonts)
- [ ] Layout matches at 1440, 1024, 768, 390

**Interactions:**
- [ ] Scroll behaviors (header, parallax, animations)
- [ ] Click behaviors (tabs, accordions, modals)
- [ ] Hover effects
- [ ] Smooth scroll feels the same as original

**Technical:**
- [ ] No console errors
- [ ] No layout shifts (CLS)
- [ ] No horizontal overflow at any breakpoint
- [ ] `npm run build` passes

### 6.3 — Deviation reporting

For each deviation found, create a fix task:
```
DEVIATION: [section] — [what's wrong]
ORIGINAL: [exact value or behavior]
CLONE: [what we have]
FIX: [what to change]
```

Fix deviations one section at a time, rebuilding after each batch.

---

## Phase 7 — Visual Feedback Loop

**Goal:** Reduce visual diff to PASS (<5%) using vision-guided patches. Enter this phase only if Phase 6 QA reports WARN or FAIL on any viewport.

This is what separates 80% clones from 95%+ clones. You have a diff image with red pixels — use it.

### 7.1 — Read the QA report

```bash
cat docs/qa/report.json
```

Check `verdict` and `diffPct` per viewport. If all are PASS — skip this phase entirely.

Record starting state:
```
Iteration 0 (baseline): desktop X.X% [VERDICT], mobile X.X% [VERDICT]
```

### 7.2 — Read the diff images visually

Open `docs/qa/diff-desktop.png` and `docs/qa/diff-mobile.png` using your vision capability.

Red pixels = pixels that differ between original and clone. Denser red = larger difference.

**Spatial mapping — what red regions mean:**

| Region of image | Likely section |
|----------------|----------------|
| Top 8-12% | Header / nav |
| Next 20-35% | Hero |
| Middle sections | Features, pricing, testimonials |
| Bottom 10-15% | Footer |
| Uniform red scatter everywhere | Systematic issue — wrong font, wrong base color, wrong line-height |
| Red only in specific columns | Grid / flex alignment off |
| Red outline around elements | Wrong border-radius, border-color, or box-shadow |
| Red at element edges | Wrong padding or margin |

### 7.3 — Diagnose before patching

For each red region, cross-reference:

1. Open `docs/qa/styles.json` → `elements` section for the affected element type
2. Open the corresponding component file in `src/components/sections/`
3. Find the specific CSS value that differs

Ask: is this one-off or systematic?
- **Systematic** (affects many elements uniformly): fix global tokens in `globals.css` first
- **One-off** (single element): patch the specific component

Common root causes ranked by frequency:
1. Wrong font-size on hero headline (most common — looks huge in diff)
2. Wrong background color on a section (bright red block)
3. Wrong padding/gap on a grid container (layout collapse)
4. Wrong font-weight (subtle but adds up)
5. Missing box-shadow on cards
6. Wrong letter-spacing on headings
7. Wrong border-radius on buttons/cards

### 7.4 — Generate targeted patches

**Rule: surgical fixes only. No full component rewrites.**

Bad:
```
Rewrite the entire Hero component
```

Good:
```
In src/components/sections/Hero.tsx line 23:
  change text-[52px] → text-[64px]
  change leading-[1.2] → leading-[1.05]
  change tracking-normal → tracking-[-0.02em]
```

Fix one category at a time. Systematic issues first, then section-specific.

Reference `docs/qa/styles.json` → `typography_scale.font_sizes` for exact px values.
Reference `docs/qa/styles.json` → `color_palette` for exact color values.
Reference `docs/qa/styles.json` → `spacing_scale` for exact padding/gap values.

### 7.5 — Re-run comparison

After applying patches:

```bash
node scripts/compare.mjs <original-url> <clone-url>
```

Read `docs/qa/report.json`. Record the new diff%:
```
Iteration 1: desktop X.X% [VERDICT], mobile X.X% [VERDICT]  [fixed: ...]
```

### 7.6 — Iterate

Repeat 7.2 → 7.5. Stop when:
- All viewports PASS (diffPct < threshold%), **or**
- 5 iterations completed, **or**
- Less than 1% improvement between two consecutive iterations (diminishing returns)

**Iteration log template:**
```
Iteration 0: desktop 22.4% FAIL,  mobile 28.1% FAIL
Iteration 1: desktop 14.2% WARN,  mobile 18.7% WARN   [fixed: hero font-size, h2 line-height]
Iteration 2: desktop  8.3% WARN,  mobile 10.1% WARN   [fixed: features grid gap, card border-radius]
Iteration 3: desktop  4.9% PASS,  mobile  6.2% WARN   [fixed: footer padding, nav letter-spacing]
Iteration 4: desktop  3.1% PASS,  mobile  4.4% PASS   DONE
```

### 7.7 — Final QA report

When loop completes, report to the user:
- Starting diff% vs final diff% per viewport
- Total iterations run
- What was fixed in each iteration
- Remaining deviations that resisted fixing (and why — animation, font not available, dynamic content)

---

## Update Mode

When a section of an existing clone needs refreshing:

1. Run `extract.py --section [selector]` to re-extract just that section
2. Diff the new manifest against the existing spec file
3. Update only the changed parts of the spec
4. Dispatch a builder agent with the updated spec + instruction to patch the existing component
5. Run visual QA on the updated section only

---

## Anti-Patterns — What Goes Wrong

**Don't start building without a complete spec.** The number one failure mode is building
components from memory or screenshots without extracted CSS values. Everything drifts.

**Don't approximate CSS values.** `padding: roughly 80px` is not the same as `padding: 80px 96px`.
Use the manifest values exactly.

**Don't use placeholder images.** Every image must be the downloaded asset. Placeholder sizes
are always wrong and cause layout drift.

**Don't name tabs without clicking them.** Tab content must be extracted state by state.
If you haven't clicked each tab, you don't know the content.

**Don't skip the interaction model decision.** Scroll-driven vs click-driven is the most common
cause of complete component rewrites. Decide before dispatch.

**Don't merge without building.** TypeScript errors compound. Merge → build → fix → repeat.

---

Reference files:
- `references/animation-playbook.md` — GSAP, Framer Motion, Lenis extraction + recreation
- `references/behavior-spec-format.md` — YAML schema for behavioral specs
- `references/component-detection.md` — Boundary detection algorithm
- `references/stack-presets.md` — Output configs for Astro, Nuxt, SvelteKit
