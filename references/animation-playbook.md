# Animation Playbook — WebCloner Reference

How to detect, extract, and recreate animations from the 5 most common animation libraries.

---

## 1. CSS Animations (no library)

**Detection:** `manifest.animations.libraries` is empty, but `@keyframes` exist in stylesheets.

**Extraction from manifest:**
Look for `animation` or `transition` properties in element `styles`. Example:
```
"animation": "fadeIn 0.6s ease-out forwards"
"transition": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
```

**Recreation:**
Copy `@keyframes` from the original stylesheet into `globals.css`. Apply via Tailwind's `animate-*`
or direct CSS class.

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.6s ease-out forwards;
}
```

**Scroll-triggered CSS animations:**
If `IntersectionObserver` is driving class toggles, recreate with:
```typescript
'use client';
import { useInView } from 'react-intersection-observer';

const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
return <div ref={ref} className={inView ? 'animate-fade-in' : 'opacity-0'} />;
```

---

## 2. Lenis (smooth scroll)

**Detection:** `manifest.animations.libraries` includes `"lenis"`.

**What it does:** Replaces native browser scroll with a physics-based smooth scroll.
Without it, the clone will feel "snappy" vs the original's "buttery" feel.

**Installation:**
```bash
npm install lenis
```

**Recreation:**
```typescript
// src/components/LenisProvider.tsx
'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,       // match original — inspect window.lenis?.options
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return <>{children}</>;
}
```

Wrap `app/layout.tsx` body with `<LenisProvider>`.

**Getting original config:** In browser console on original site:
```javascript
window.lenis?.options  // duration, easing, lerp, etc.
```

---

## 3. GSAP + ScrollTrigger

**Detection:** `manifest.animations.libraries` includes `"gsap"`.

**Installation:**
```bash
npm install gsap
```

**Extraction approach:**
In browser console on original site:
```javascript
// List all active tweens
gsap.globalTimeline.getChildren().forEach(t => {
  console.log({
    target: t.targets?.(),
    duration: t.duration(),
    vars: t.vars,
  });
});

// List all ScrollTrigger instances
ScrollTrigger.getAll().forEach(st => {
  console.log({
    trigger: st.trigger,
    start: st.start,
    end: st.end,
    scrub: st.vars.scrub,
    pin: st.vars.pin,
  });
});
```

**Recreation pattern:**
```typescript
'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function AnimatedSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return <div ref={ref}>...</div>;
}
```

**Common GSAP patterns to look for:**
- `scrub: true` — animation tied to scroll position (not time-based)
- `pin: true` — section stays fixed while scroll animation plays
- `stagger` — sequential animation of multiple elements
- `timeline` — chained sequence of animations

---

## 4. Framer Motion

**Detection:** `manifest.animations.libraries` includes `"framer-motion"`.

**Installation:**
```bash
npm install framer-motion
```

**Extraction:** Framer Motion animations are React component props. In React DevTools,
inspect the component tree and look for `motion.*` elements with `initial`, `animate`,
`whileInView`, `variants` props.

If DevTools not available, infer from visual behavior:
- Fade in on scroll → `whileInView={{ opacity: 1 }}` with `initial={{ opacity: 0 }}`
- Slide up on scroll → add `y: 0` animate, `y: 40` initial
- Hover scale → `whileHover={{ scale: 1.05 }}`
- Exit animation → `exit={{ opacity: 0 }}`

**Recreation pattern:**
```typescript
import { motion } from 'framer-motion';

const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export function FeatureCard() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      ...
    </motion.div>
  );
}
```

**Stagger children:**
```typescript
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
```

---

## 5. AOS (Animate on Scroll)

**Detection:** `manifest.animations.libraries` includes `"aos"` or elements have `data-aos` attributes.

**Extraction:**
```javascript
// In browser console — get all AOS attributes
document.querySelectorAll('[data-aos]').forEach(el => {
  console.log({
    selector: el.className,
    aos: el.dataset.aos,
    duration: el.dataset.aosDuration,
    delay: el.dataset.aosDelay,
    easing: el.dataset.aosEasing,
  });
});
```

**Recreation options:**

Option A — Use AOS directly:
```bash
npm install aos
```
```typescript
'use client';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

export function AOSProvider({ children }) {
  useEffect(() => { AOS.init({ duration: 800, once: true }); }, []);
  return <>{children}</>;
}
```
Then add `data-aos="fade-up"` attributes to match original.

Option B — Replace with Framer Motion (cleaner, no extra dependency):
Map AOS animation names to Framer Motion variants.
`fade-up` → `{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }`

---

## Animation Decision Tree

```
Is the animation triggered by scroll position?
  → YES: Is it scrubbed (tied to scroll position, not time)?
      → YES: GSAP with scrub: true
      → NO: GSAP ScrollTrigger OR Framer Motion whileInView OR IntersectionObserver
  → NO: Is it triggered on click?
      → YES: CSS transition OR Framer Motion AnimatePresence
      → NO: Is it on hover?
          → YES: CSS :hover transition OR Framer Motion whileHover
          → NO: Is it on page load?
              → YES: CSS animation OR Framer Motion initial/animate
```

---

## Timing Extraction

If you can't get library config, estimate from visual inspection:

| Visual feel | Duration estimate | Easing |
|-------------|------------------|--------|
| Instant snap | 150-200ms | linear |
| Quick and clean | 200-300ms | ease-out |
| Smooth and polished | 300-500ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Deliberate and dramatic | 600-900ms | power2.out (GSAP) |
| Scroll-scrubbed | no duration | scrub: true |
