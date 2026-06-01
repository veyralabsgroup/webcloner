# webcloner

Clone any landing page, marketing site, portfolio, or ecommerce storefront into a pixel-accurate Next.js replica. Works with Claude Code and other AI coding agents.

```bash
npx @veyralabs/skills install webcloner
```

---

## How it works

Most cloning attempts fail at 80% because they guess at interactions, miss assets, or start writing components before fully understanding what they're building. This skill forces the right order.

Six phases, each with a clear goal:

**Phase 1 - Recon.** Run `extract.py` against the target URL. Scrapling loads the full page, scrolls to trigger lazy loads, and extracts the DOM structure, computed CSS for every visible element, asset inventory, color palette, typography system, animation library signatures, and tech stack. Output is a single JSON manifest.

**Phase 2 - Foundation.** Set up the Next.js project and apply global tokens from the manifest before touching any component: fonts, color variables, typography scale, animation libraries, downloaded assets converted to WebP.

**Phase 3 - Spec.** Generate a machine-readable spec file for each section of the page. Every spec includes the DOM structure, exact computed CSS values, responsive behavior at four breakpoints, YAML-formatted interaction definitions, and verbatim text content. No building happens until all specs are complete and reviewed.

**Phase 4 - Parallel build.** Each section gets its own git worktree and builder agent. Agents work simultaneously and build exactly what the spec describes. After each merge, `npm run build` runs to catch TypeScript errors before they compound.

**Phase 5 - Assembly.** Wire all section components into `page.tsx` in DOM order. Implement page-level behaviors: sticky header, smooth scroll provider, GSAP context, scroll progress indicators.

**Phase 6 - Visual QA.** `compare.mjs` screenshots the original and the clone at 1440px and 390px. Side-by-side comparison, size diff report, manual checklist for typography, spacing, interactions, and responsive behavior.

---

## What it handles

Landing pages, marketing sites, portfolios, agency sites, ecommerce product listings and storefronts.

Not designed for SaaS dashboards, admin panels, auth flows, real-time data, or checkout flows. If the target is out of scope, the skill says so before starting rather than producing a broken half-clone.

---

## Prerequisites

```bash
pip install scrapling
scrapling install

node --version  # 18+
```

---

## Install

```bash
npx @veyralabs/skills install webcloner
```

Manual install - copy to your agent's skills directory:

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

The skill activates automatically. It will ask for your input at two points: after the recon summary (confirm scope and interaction model decisions) and after visual QA (approve or request fixes).

---

## What's included

```
SKILL.md                         skill definition loaded by Claude Code
scripts/
  extract.py                     Scrapling extractor - DOM, CSS, assets, animations
  download-assets.mjs            image/video/font downloader with WebP conversion
  compare.mjs                    screenshot original vs clone at desktop and mobile
references/
  animation-playbook.md          GSAP, Framer Motion, Lenis, AOS detection and recreation
  behavior-spec-format.md        YAML schema for interaction specs with examples
  component-detection.md         boundary detection algorithm and complexity scoring
  stack-presets.md               output configs for Astro, Nuxt, SvelteKit, Vite
```

---

## Part of VeyraSkills

Part of [VeyraSkills](https://github.com/veyralabsgroup/veyraskills), a collection of Claude Code skills for founders, developers, and builders.

---

## License

MIT. Built by [VeyraLabs](https://veyralabs.com).
