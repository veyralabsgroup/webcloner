# webcloner

Clone any landing page, marketing site, portfolio, or ecommerce storefront into a pixel-accurate Next.js replica. Works with Claude Code and other AI coding agents.

```bash
npx @veyralabs/skills install webcloner
```

---

## How it works

Most cloning attempts fail at 80% because they guess at styles, miss assets, or start writing components before fully understanding what they're building. This skill forces the right order — and closes the gap with a visual feedback loop that iterates until the diff is gone.

**7 phases:**

**Phase 1 - Recon.** Run `extract.py` to pull DOM structure, asset inventory, animation signatures, and tech stack from the target. Then run `extract-styles.mjs` to capture exact computed CSS values — not raw stylesheet text, but what the browser actually renders after all cascading rules apply. Output: `docs/site-manifest.json` + `docs/qa/styles.json` with color palette, typography scale, spacing scale, CSS custom properties, and per-element computed styles.

**Phase 2 - Foundation.** Set up the Next.js project and apply global tokens before touching any component — fonts, color variables, typography scale, animation libraries, downloaded assets in WebP. All values come from `docs/qa/styles.json` — exact px, not approximations.

**Phase 3 - Spec (multi-agent).** Five parallel agents each analyze one dimension of each section: Layout (grid/flex config, breakpoints), Typography (exact font-size/weight/line-height per element), Color (full palette by role), Spacing (padding/margin/gap scale with Tailwind mapping), Component (shadcn/Radix detection, interaction states, verbatim copy). Each produces a dimension fragment; all five merge into a complete section spec. One generalist guessing everything misses details. Five specialists each focused on one lens don't.

**Phase 4 - Parallel build.** Each section gets its own git worktree and builder agent. Agents work simultaneously from the specs. After each merge, `npm run build` catches TypeScript errors before they compound.

**Phase 5 - Assembly.** Wire section components into `page.tsx` in DOM order. Implement page-level behaviors: sticky header, smooth scroll, GSAP context, scroll progress.

**Phase 6 - Visual QA.** `compare.mjs` takes pixel-accurate screenshots of original and clone at 1440px and 390px, runs pixelmatch, generates a red diff image, and gives a PASS / WARN / FAIL verdict per viewport based on % pixels different.

**Phase 7 - Visual feedback loop.** If QA returns WARN or FAIL, the loop begins. Either run `visual-loop.mjs` for hands-free iteration, or follow the manual steps. Each round: read the diff image (red pixels show exactly what's wrong), identify the root cause using design tokens from `styles.json`, apply a surgical patch, re-run compare.mjs. Stops when all viewports reach PASS or improvement drops below 1%. Typical result: 3-4 iterations, 70% → 95%+ accuracy.

---

## What it handles

Landing pages, marketing sites, portfolios, agency sites, ecommerce product listings and storefronts.

Not designed for SaaS dashboards, admin panels, auth flows, real-time data, or checkout flows. If the target is out of scope, the skill says so before starting.

---

## Prerequisites

```bash
pip install scrapling
scrapling install

node --version  # 18+

npm install playwright pixelmatch pngjs
npx playwright install chromium
```

For automated visual loop:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Install

```bash
npx @veyralabs/skills install webcloner
```

Manual — copy to your agent's skills directory:

| Agent | Path |
|-------|------|
| Claude Code | `.claude/skills/` |
| Cursor | `.cursor/skills/` |
| Windsurf | `.windsurf/skills/` |
| Gemini CLI | `.gemini/skills/` |

---

## Usage

Once installed, describe what you want:

```
Clone this landing page: https://example.com
Rebuild this design in Next.js: https://example.com
I want my site to look like this: https://example.com
```

The skill activates automatically and walks through all 7 phases. It pauses for your input twice: after recon (confirm scope and interaction model) and after Phase 6 QA (approve result or trigger Phase 7 loop).

---

## Scripts

```
scripts/
  extract.py              Scrapling extractor — DOM, CSS, assets, animations, tech stack
  extract-styles.mjs      Computed styles via Playwright — exact post-cascade values per element
  download-assets.mjs     Image/video/font downloader with WebP conversion
  compare.mjs             Pixel-accurate screenshot diff — pixelmatch, PASS/WARN/FAIL, diff image
  visual-loop.mjs         Automated N-iteration loop — Claude Vision reads diff, patches code, repeats
```

### compare.mjs

```bash
node scripts/compare.mjs <original-url> <clone-url> [--threshold 5]
```

Generates:
- `docs/qa/original-{viewport}.png` — reference screenshot
- `docs/qa/clone-{viewport}.png` — clone screenshot
- `docs/qa/diff-{viewport}.png` — red pixels mark visual differences
- `docs/qa/report.json` — diffPct, verdict, pixel counts per viewport

### extract-styles.mjs

```bash
node scripts/extract-styles.mjs <url> [--out docs/qa/styles.json]
```

Extracts exact computed values — not raw CSS text. Feed into Phase 3 specs for pixel-accurate component generation.

### visual-loop.mjs

```bash
node scripts/visual-loop.mjs <original-url> <clone-url> [--threshold 5] [--max-iterations 5]
```

Fully automated: runs compare → sends diff image to Claude Vision → gets patches → applies them → repeats. Saves full log to `docs/qa/loop-log.json`. Exits 0 on PASS, 1 if FAIL persists.

---

## References

```
references/
  animation-playbook.md     GSAP, Framer Motion, Lenis, AOS — detection and recreation
  behavior-spec-format.md   YAML schema for interaction specs
  component-detection.md    Boundary detection algorithm and complexity scoring
  stack-presets.md          Output configs for Astro, Nuxt, SvelteKit, Vite
```

---

## Part of VeyraSkills

Part of [VeyraSkills](https://github.com/veyralabsgroup/veyraskills) — open-source skills for Claude Code.

---

## License

MIT. Built by [VeyraLabs](https://veyralabs.com).
