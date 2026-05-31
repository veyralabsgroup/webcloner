# Behavior Spec Format — WebCloner Reference

YAML schema for describing interactive behaviors in component specs.
Paste into the `## States & Behaviors` section of each `docs/specs/*.spec.md` file.

---

## Schema

```yaml
behaviors:
  - name: string              # human label, e.g. "Tab switch"
    trigger:
      type: click | hover | scroll | load | resize
      selector: string        # CSS selector of the interactive element
      condition: string       # optional — e.g. "scrollY > 80", "viewport < 768"
    states:
      [state-name]:
        [property]: [value]   # visual/content properties in this state
    transition:
      duration: string        # e.g. "200ms"
      easing: string          # e.g. "ease-out", "cubic-bezier(0.4, 0, 0.2, 1)"
      property: string        # optional — which CSS property animates (all = default)
    notes: string             # optional — anything that doesn't fit above
```

---

## Examples by Behavior Type

### Click — Tab Switch

```yaml
behaviors:
  - name: "Feature tabs"
    trigger:
      type: click
      selector: ".tab-button"
    states:
      default:
        activeIndex: 0
        content: "First tab content visible"
        activeTab:
          background: "#000"
          color: "#fff"
        inactiveTab:
          background: "transparent"
          color: "#666"
      tab-2:
        activeIndex: 1
        content: "Second tab content visible"
      tab-3:
        activeIndex: 2
        content: "Third tab content visible"
    transition:
      duration: 200ms
      easing: ease-out
      property: opacity
```

### Scroll — Header Transform

```yaml
behaviors:
  - name: "Sticky header"
    trigger:
      type: scroll
      condition: "scrollY > 80"
    states:
      default:
        position: fixed
        top: 0
        background: transparent
        backdropFilter: none
        padding: "24px 80px"
        logo: large
      scrolled:
        background: "rgba(255,255,255,0.9)"
        backdropFilter: "blur(12px)"
        padding: "12px 80px"
        boxShadow: "0 1px 0 rgba(0,0,0,0.08)"
        logo: small
    transition:
      duration: 300ms
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
      property: all
```

### Hover — Card

```yaml
behaviors:
  - name: "Feature card hover"
    trigger:
      type: hover
      selector: ".feature-card"
    states:
      default:
        transform: none
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        borderColor: "#e5e7eb"
      hovered:
        transform: "translateY(-4px)"
        boxShadow: "0 12px 32px rgba(0,0,0,0.12)"
        borderColor: "#000"
    transition:
      duration: 250ms
      easing: ease-out
      property: "transform, box-shadow, border-color"
```

### Load — Hero Entrance

```yaml
behaviors:
  - name: "Hero entrance"
    trigger:
      type: load
      condition: "DOMContentLoaded"
    states:
      before:
        opacity: 0
        transform: "translateY(30px)"
      after:
        opacity: 1
        transform: "translateY(0)"
    transition:
      duration: 800ms
      easing: "cubic-bezier(0.16, 1, 0.3, 1)"
    notes: "Headline first (delay 0), subtitle +200ms, CTA +400ms (stagger)"
```

### Scroll-driven — Parallax

```yaml
behaviors:
  - name: "Hero background parallax"
    trigger:
      type: scroll
      condition: "element in viewport"
    states:
      top:
        backgroundPositionY: "0%"
      bottom:
        backgroundPositionY: "30%"
    transition:
      duration: scrub       # scrub = tied to scroll position, not time
      easing: linear
    notes: "GSAP scrub:true — background moves at 0.3x scroll speed"
```

### Click — Accordion

```yaml
behaviors:
  - name: "FAQ accordion"
    trigger:
      type: click
      selector: ".accordion-trigger"
    states:
      closed:
        contentHeight: 0
        overflow: hidden
        icon: "+"
      open:
        contentHeight: auto   # animate max-height from 0 to auto
        overflow: visible
        icon: "−"
    transition:
      duration: 300ms
      easing: ease-out
      property: max-height
    notes: "Only one item open at a time. Opening one closes others."
```

### Hover — Navigation Dropdown

```yaml
behaviors:
  - name: "Nav dropdown"
    trigger:
      type: hover
      selector: ".nav-item[data-has-dropdown]"
    states:
      closed:
        dropdownOpacity: 0
        dropdownTransform: "translateY(-8px)"
        dropdownPointerEvents: none
      open:
        dropdownOpacity: 1
        dropdownTransform: "translateY(0)"
        dropdownPointerEvents: auto
    transition:
      duration: 200ms
      easing: ease-out
    notes: "Close on mouseleave with 100ms delay to allow cursor travel to dropdown"
```

---

## Multi-state Components

When a component has more than 2 states, list all states explicitly:

```yaml
behaviors:
  - name: "Carousel"
    trigger:
      type: click
      selector: ".carousel-arrow"
    states:
      slide-1: { activeIndex: 0, transform: "translateX(0%)" }
      slide-2: { activeIndex: 1, transform: "translateX(-100%)" }
      slide-3: { activeIndex: 2, transform: "translateX(-200%)" }
    transition:
      duration: 400ms
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    notes: "Loop: last → first. Dots sync with activeIndex."
```

---

## Scroll-triggered Entrance Animations

These use IntersectionObserver (or ScrollTrigger) — not pure scroll position.

```yaml
behaviors:
  - name: "Section entrance"
    trigger:
      type: scroll
      condition: "element enters viewport at threshold 0.2"
    states:
      before:
        opacity: 0
        transform: "translateY(40px)"
      visible:
        opacity: 1
        transform: "translateY(0)"
    transition:
      duration: 600ms
      easing: "cubic-bezier(0.16, 1, 0.3, 1)"
    notes: "triggerOnce: true — does not reverse on scroll up"
```

---

## Implementation Mapping

| Behavior type | Recommended implementation |
|---------------|---------------------------|
| CSS-only hover/focus | Tailwind `hover:` / `focus:` classes |
| Click toggle (React state) | `useState` + conditional className |
| Scroll position check | `useEffect` + scroll event listener |
| Scroll entrance animation | `react-intersection-observer` useInView |
| Scroll-scrubbed | GSAP + `scrub: true` |
| Smooth scroll feel | Lenis |
| Complex sequence/exit | Framer Motion `AnimatePresence` |
| Stagger children | Framer Motion `staggerChildren` or GSAP `stagger` |
