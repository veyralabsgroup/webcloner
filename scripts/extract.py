#!/usr/bin/env python3
"""
extract.py — Site manifest extractor using Scrapling.

Usage:
  python scripts/extract.py <url> [--output path/to/manifest.json] [--section ".selector"]

Output: JSON manifest with DOM structure, computed CSS, assets, animations, and tech stack.
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    from scrapling import AsyncPlaywrightFetcher
except ImportError:
    print("ERROR: scrapling not installed. Run: pip install scrapling && scrapling install")
    sys.exit(1)


# CSS properties to extract for each significant element
CSS_PROPERTIES = [
    "display", "position", "top", "right", "bottom", "left", "z-index",
    "width", "min-width", "max-width", "height", "min-height", "max-height",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "flex-direction", "flex-wrap", "justify-content", "align-items", "align-self",
    "flex", "flex-grow", "flex-shrink", "flex-basis", "gap", "row-gap", "column-gap",
    "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
    "font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "text-align", "text-transform", "text-decoration", "color",
    "background-color", "background-image", "background-size", "background-position",
    "border", "border-radius", "border-color", "border-width", "border-style",
    "box-shadow", "opacity", "overflow", "overflow-x", "overflow-y",
    "transform", "transition", "animation", "animation-name", "animation-duration",
    "cursor", "pointer-events", "user-select",
    "object-fit", "object-position", "aspect-ratio",
]


ANIMATION_SIGNATURES = {
    "gsap": [
        "window.gsap !== undefined",
        "window.ScrollTrigger !== undefined",
        "window.ScrollSmoother !== undefined",
    ],
    "framer-motion": [
        "document.querySelector('[data-framer-appear]') !== null",
        "document.querySelector('[data-projection-id]') !== null",
    ],
    "lenis": [
        "window.lenis !== undefined",
        "document.documentElement.classList.contains('lenis')",
        "document.querySelector('.lenis') !== null",
    ],
    "aos": [
        "document.querySelector('[data-aos]') !== null",
    ],
    "swiper": [
        "window.Swiper !== undefined",
        "document.querySelector('.swiper') !== null",
    ],
    "locomotive": [
        "document.querySelector('[data-scroll-container]') !== null",
        "window.LocomotiveScroll !== undefined",
    ],
}


EXTRACTION_SCRIPT = """
() => {
  const CSS_PROPS = %s;

  function getComputedStyleMap(el) {
    const cs = window.getComputedStyle(el);
    const result = {};
    for (const prop of CSS_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
        result[prop] = val;
      }
    }
    return result;
  }

  function extractElement(el, depth) {
    if (depth > 4) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const result = {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList).slice(0, 10),
      text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.textContent.trim().slice(0, 200)
        : null,
      href: el.tagName === 'A' ? el.href : null,
      src: el.tagName === 'IMG' ? el.src : null,
      alt: el.tagName === 'IMG' ? el.alt : null,
      styles: getComputedStyleMap(el),
      bounds: {
        top: Math.round(rect.top + window.scrollY),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      children: [],
    };

    if (depth < 3) {
      for (const child of el.children) {
        const childData = extractElement(child, depth + 1);
        if (childData) result.children.push(childData);
      }
    }

    return result;
  }

  // Extract sections (top-level structural blocks)
  const sectionSelectors = [
    'header', 'nav', 'main', 'footer', 'section', 'article',
    '[class*="section"]', '[class*="hero"]', '[class*="banner"]',
    '[id*="section"]', '[id*="hero"]',
  ];

  const seen = new Set();
  const sections = [];

  for (const sel of sectionSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const data = extractElement(el, 0);
      if (data) sections.push(data);
    }
  }

  // Color palette from all computed background-colors
  const colors = new Set();
  document.querySelectorAll('*').forEach(el => {
    const cs = window.getComputedStyle(el);
    const bg = cs.backgroundColor;
    const color = cs.color;
    if (bg && bg !== 'rgba(0, 0, 0, 0)') colors.add(bg);
    if (color && color !== 'rgba(0, 0, 0, 0)') colors.add(color);
  });

  // Typography from headings and body text
  const typography = [];
  ['h1','h2','h3','h4','p','a','span','li'].forEach(tag => {
    const el = document.querySelector(tag);
    if (el) {
      const cs = window.getComputedStyle(el);
      typography.push({
        tag,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: cs.color,
      });
    }
  });

  // Asset inventory
  const images = Array.from(document.querySelectorAll('img')).map(img => ({
    src: img.src,
    alt: img.alt,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    lazy: img.loading === 'lazy',
  }));

  const videos = Array.from(document.querySelectorAll('video')).map(v => ({
    src: v.src || (v.querySelector('source') ? v.querySelector('source').src : null),
    poster: v.poster,
    autoplay: v.autoplay,
    loop: v.loop,
    muted: v.muted,
  }));

  const fonts = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(l => l.href)
    .filter(h => h.includes('fonts.googleapis') || h.includes('typekit') || h.includes('fonts.adobe'));

  const svgs = Array.from(document.querySelectorAll('svg')).map((svg, i) => ({
    id: svg.id || `svg-${i}`,
    viewBox: svg.getAttribute('viewBox'),
    html: svg.outerHTML.slice(0, 500),
  }));

  return { sections, colorPalette: Array.from(colors), typography, assets: { images, videos, fonts, svgs } };
}
""" % json.dumps(CSS_PROPERTIES)


async def detect_animations(page):
    detected = []
    for lib, checks in ANIMATION_SIGNATURES.items():
        for check in checks:
            try:
                result = await page.evaluate(f"() => {{ try {{ return Boolean({check}); }} catch(e) {{ return false; }} }}")
                if result:
                    detected.append(lib)
                    break
            except Exception:
                pass
    return list(set(detected))


async def detect_tech_stack(page):
    stack = {}

    checks = {
        "react": "window.__NEXT_DATA__ !== undefined || window.React !== undefined",
        "nextjs": "window.__NEXT_DATA__ !== undefined",
        "vue": "window.__VUE__ !== undefined || document.querySelector('[data-v-app]') !== null",
        "nuxt": "window.__NUXT__ !== undefined",
        "svelte": "document.querySelector('[data-svelte]') !== null",
        "webflow": "document.querySelector('html[data-wf-site]') !== null",
        "framer": "document.querySelector('html[data-framer-hydrate-v2]') !== null",
        "shopify": "window.Shopify !== undefined",
        "wordpress": "document.querySelector('meta[name=\"generator\"][content^=\"WordPress\"]') !== null",
        "tailwind": "Array.from(document.querySelectorAll('*')).some(el => Array.from(el.classList).some(c => /^(flex|grid|p-|m-|text-|bg-|w-|h-)/.test(c)))",
    }

    for name, check in checks.items():
        try:
            result = await page.evaluate(f"() => {{ try {{ return Boolean({check}); }} catch(e) {{ return false; }} }}")
            if result:
                stack[name] = True
        except Exception:
            pass

    return stack


async def extract(url, output_path, section_selector=None):
    print(f"Extracting: {url}")

    fetcher = AsyncPlaywrightFetcher(headless=True)

    page_data = await fetcher.async_fetch(
        url,
        wait_selector="body",
        wait_for="networkidle",
        page_action=None,
    )

    # Use the underlying Playwright page for JS evaluation
    async with fetcher._get_browser_context() as context:
        page = await context.new_page()
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_timeout(2000)  # let animations settle

        # Scroll to trigger lazy loads
        await page.evaluate("""
            async () => {
                const height = document.body.scrollHeight;
                for (let y = 0; y < height; y += 200) {
                    window.scrollTo(0, y);
                    await new Promise(r => setTimeout(r, 50));
                }
                window.scrollTo(0, 0);
                await new Promise(r => setTimeout(r, 500));
            }
        """)

        animations = await detect_animations(page)
        tech_stack = await detect_tech_stack(page)
        dom_data = await page.evaluate(EXTRACTION_SCRIPT)

        # Get page title and meta
        title = await page.title()
        meta_desc = await page.evaluate(
            "() => document.querySelector('meta[name=\"description\"]')?.content || ''"
        )

        # Detect breakpoints from stylesheets
        breakpoints = await page.evaluate("""
            () => {
                const bps = new Set();
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule.type === CSSRule.MEDIA_RULE) {
                                const match = rule.conditionText.match(/\\d+/g);
                                if (match) match.forEach(n => bps.add(parseInt(n)));
                            }
                        }
                    } catch(e) {}
                }
                return Array.from(bps).sort((a,b) => a-b);
            }
        """)

    manifest = {
        "url": url,
        "title": title,
        "description": meta_desc,
        "techStack": tech_stack,
        "animations": {
            "libraries": animations,
        },
        "breakpoints": breakpoints,
        "colorPalette": dom_data["colorPalette"][:30],
        "typography": dom_data["typography"],
        "sections": dom_data["sections"],
        "assets": dom_data["assets"],
    }

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    print(f"\nManifest written to: {output_path}")
    print(f"  Sections found:   {len(manifest['sections'])}")
    print(f"  Images found:     {len(manifest['assets']['images'])}")
    print(f"  SVGs found:       {len(manifest['assets']['svgs'])}")
    print(f"  Animation libs:   {', '.join(animations) or 'none detected'}")
    print(f"  Tech stack:       {', '.join(k for k,v in tech_stack.items() if v)}")
    print(f"  Breakpoints:      {breakpoints}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Extract site manifest")
    parser.add_argument("url", help="Target URL")
    parser.add_argument("--output", default="docs/site-manifest.json", help="Output path")
    parser.add_argument("--section", default=None, help="CSS selector to scope extraction")
    args = parser.parse_args()

    asyncio.run(extract(args.url, args.output, args.section))


if __name__ == "__main__":
    main()
