# Component Detection — WebCloner Reference

Algorithm for detecting component boundaries from `docs/site-manifest.json` → `sections`.

---

## Core Rule

**One component = one repeating unit OR one structurally isolated block.**

Don't split by DOM depth. Split by visual/functional independence.

---

## Detection Algorithm

### Step 1 — Map top-level sections

Start from `manifest.sections`. Each entry in the array is a candidate component boundary.

```
For each section in manifest.sections:
  - tag is <header> → HeaderNav component
  - tag is <footer> → Footer component
  - tag is <main> → recurse into children
  - tag is <section> or <article> → candidate section component
```

### Step 2 — Detect repeating patterns

Within a section's `children`, look for repeating structure:

```
If section.children has N items where N >= 2:
  AND all items share the same tag
  AND all items have similar class patterns
  → This is a list/grid component with repeated cards
  → One parent component + one card sub-component
```

**Signal:** Items with identical class prefixes at depth 1:
- `feature-card`, `feature-card`, `feature-card` → `FeatureCard` component
- `team-member`, `team-member` → `TeamMember` component
- `pricing-plan`, `pricing-plan` → `PricingCard` component

### Step 3 — Detect functional groups

Look for elements that only appear together and serve one function:

```
headline + subheadline + CTA buttons
→ NOT 3 components. ONE hero content block.

tab-nav + tab-panels
→ NOT separate. ONE tabs component with internal state.

form label + input + error message + submit
→ ONE form component.
```

**Rule:** If removing one element makes the others meaningless → they're one component.

### Step 4 — Detect overlay components

Elements positioned absolutely or with high z-index are separate components:
- `position: fixed` + `z-index > 10` → overlay/modal
- `position: sticky` → sticky bar (separate from section it's in)
- `overflow: hidden` on parent + transformed child → carousel/slider

---

## Component Boundary Signals

| Signal | Component type |
|--------|---------------|
| `<header>` tag | HeaderNav |
| `<footer>` tag | Footer |
| `<nav>` tag | Navigation (may be inside HeaderNav) |
| Full-width bg change | New section boundary |
| `position: fixed`, high `z-index` | Overlay / Modal |
| `position: sticky` | Sticky bar / floating CTA |
| N identical sibling structures | List + Card components |
| Form elements grouped | Form component |
| `overflow: hidden` + transform | Carousel / Slider |
| `[data-modal]`, `[role="dialog"]` | Modal component |
| `[role="tablist"]` + `[role="tab"]` | Tabs component |

---

## Common Sections → Component Names

```
hero               → Hero.tsx
features           → Features.tsx (+ FeatureCard.tsx if cards)
pricing            → Pricing.tsx (+ PricingCard.tsx)
testimonials       → Testimonials.tsx (+ TestimonialCard.tsx)
team               → Team.tsx (+ TeamMember.tsx)
faq                → FAQ.tsx (+ FAQItem.tsx)
cta-section        → CTASection.tsx
logos / trusted-by → LogoStrip.tsx
stats              → Stats.tsx (+ StatItem.tsx)
blog-preview       → BlogPreview.tsx (+ BlogCard.tsx)
contact-form       → ContactForm.tsx
newsletter         → NewsletterSignup.tsx
header / nav       → HeaderNav.tsx
footer             → Footer.tsx
```

---

## Nesting Decision

**Flatten aggressively.** The goal is readable components, not a perfect DOM mirror.

```
BAD — too granular:
  <Section>
    <SectionInner>
      <SectionContent>
        <SectionHeadline />
```

```
GOOD — right level:
  <Features>
    <h2>Headline</h2>
    {features.map(f => <FeatureCard key={f.id} {...f} />)}
```

**Rule:** Create a sub-component only if:
1. It repeats (N >= 2 instances), OR
2. It has its own behavior state, OR
3. It's independently reusable across the page

---

## Props Extraction

For each component, identify what varies vs what's fixed:

**Fixed** (hardcode in component):
- Layout structure
- CSS classes / styles
- Animation parameters

**Variable** (extract as props):
- Text content
- Images/icons
- URLs/hrefs
- Counts/numbers
- Boolean toggles

Example for FeatureCard:
```typescript
interface FeatureCardProps {
  icon: string;        // path to public/images/icon-*.svg
  title: string;
  description: string;
  href?: string;
}
```

---

## Complexity Score

Rate each component before dispatching builder agents:

| Score | Criteria | Estimated build time |
|-------|----------|---------------------|
| 1 — Simple | Static, no behavior, <= 3 elements | 10-20 min |
| 2 — Medium | Hover states OR responsive reflow | 20-40 min |
| 3 — Complex | Click behavior + multiple states | 40-90 min |
| 4 — Hard | Scroll animation + GSAP/Framer | 90-180 min |
| 5 — Very hard | Multiple behaviors + complex responsive | 3+ hours |

Build order: simple first (1-2), then medium (3), then complex (4-5).
Complex components should get extra spec detail before dispatch.

---

## Red Flags — Components to Watch

**Tabs with scroll-driven content:**
Some designs show tabs that switch based on scroll position. Confirm by checking:
```javascript
// In browser console
ScrollTrigger.getAll().forEach(st => console.log(st.trigger, st.vars))
```
If trigger is the tab content area → scroll-driven.
If not → click-driven. Decision critical before building.

**Carousels with touch:**
Mobile swipe carousels need extra handling. Check:
```javascript
document.querySelectorAll('[class*="swiper"], [class*="splide"], [class*="glide"]')
```
If found → use the same library rather than rebuilding from scratch.

**Sticky + scroll behavior:**
Components with both `position: sticky` AND scroll-triggered style changes are two behaviors on one element.
Document both separately in the behavior spec.

**Lazy-loaded sections:**
Some sections only render after scroll. Scrapling's scroll-and-wait handles this, but verify:
```javascript
manifest.sections.length  // should match visible section count on page
```
If low count → re-run `extract.py` with longer scroll delay.
