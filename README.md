# WebCloner — Website Visual Cloning Skill for Claude Code

Clone any landing page, marketing site, portfolio, or ecommerce storefront into a pixel-accurate Next.js replica.

```bash
npx @veyralabs/skills install webcloner
```

---

## What it does

**WebCloner** is a Claude Code skill that guides you through a structured 6-phase process to clone any website's visual design:

1. **Recon** — Extract DOM structure, computed CSS, assets, and animation libraries automatically via Scrapling
2. **Foundation** — Set up Next.js with exact color tokens, typography, and downloaded assets
3. **Spec** — Generate machine-readable specs for each section before writing any component code
4. **Parallel Build** — Dispatch builder agents per section using git worktrees
5. **Assembly** — Wire all sections into the final page with page-level behaviors
6. **Visual QA** — Screenshot comparison between original and clone at desktop + mobile

---

## Scope

**Works well for:**
- Landing pages
- Marketing sites
- Portfolio sites
- Ecommerce storefronts (product listings, product pages)
- Agency / studio sites

**Not designed for:**
- SaaS dashboards or admin panels
- Apps with authentication flows
- Sites with real-time data (live prices, WebSockets)
- Checkout + payment flows

---

## Prerequisites

```bash
# Python 3.10+ with Scrapling
pip install scrapling
scrapling install

# Node 18+
node --version
```

---

## Installation

```bash
# Via veyraskills CLI
npx @veyralabs/skills install webcloner

# Or clone this repo and copy to .claude/skills/
git clone https://github.com/veyralabsgroup/webcloner
cp -r webcloner/. .claude/skills/webcloner/
```

---

## Usage

Once installed, activate in any Claude Code session:

```
/webcloner https://example.com
```

Or describe what you want:
```
Clone this landing page: https://example.com
```

Claude will guide you through the full process, asking only when a decision requires your input.

---

## Included

```
SKILL.md                          ← skill definition (loaded by Claude Code)
scripts/
  extract.py                      ← Scrapling-based site manifest extractor
  download-assets.mjs             ← image/video/font downloader with WebP conversion
  compare.mjs                     ← visual regression: screenshot original vs clone
references/
  animation-playbook.md           ← GSAP, Framer Motion, Lenis, AOS recreation guide
  behavior-spec-format.md         ← YAML schema for interactive behavior specs
  component-detection.md          ← boundary detection algorithm
  stack-presets.md                ← Astro, Nuxt, SvelteKit, Vite output configs
```

---

## Part of VeyraSkills

This skill is part of the [VeyraSkills](https://github.com/veyralabsgroup/veyraskills) collection — a curated set of Claude Code skills for founders, developers, and AI builders.

```bash
# Install all VeyraSkills
npx @veyralabs/skills install naming-suite
npx @veyralabs/skills install webcloner
```

---

## License

MIT
