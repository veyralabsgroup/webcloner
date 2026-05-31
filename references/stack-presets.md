# Stack Presets — WebCloner Reference

Output configs when the clone target is NOT Next.js.
Default stack is Next.js 15 + TypeScript + Tailwind v4 + shadcn.
Use these presets when the user requests a different framework.

---

## When to Use Alternate Stacks

| Use case | Recommended stack |
|----------|------------------|
| Default / most cases | Next.js 15 |
| Static site, no JS needed | Astro |
| Vue ecosystem / Nuxt site clone | Nuxt 3 |
| Svelte preference | SvelteKit |
| Shopify storefront | Hydrogen (Remix-based) |
| Existing React project | Vite + React |

---

## Astro

**Best for:** Static marketing sites, portfolios, blogs. Zero JS by default.

### Setup

```bash
npm create astro@latest clone -- --template minimal --typescript strict --install --no-git
cd clone
npx astro add tailwind
npx astro add react  # only if interactive components needed
```

### File structure

```
src/
  layouts/
    Layout.astro       ← base layout (fonts, globals)
  components/
    Hero.astro         ← static sections as .astro
    Features.astro
    FeatureCard.astro
    Header.astro
    Footer.astro
    Tabs.tsx           ← interactive components as .tsx (React island)
  pages/
    index.astro        ← assemble all sections
public/
  images/
  fonts/
```

### Component template

```astro
---
// Hero.astro
interface Props {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
}
const { headline, subheadline, ctaText, ctaHref } = Astro.props;
---

<section class="hero">
  <h1>{headline}</h1>
  <p>{subheadline}</p>
  <a href={ctaHref}>{ctaText}</a>
</section>

<style>
  /* scoped styles */
</style>
```

### Interactive islands

Components that need JS (tabs, carousels, modals) use React with `client:load`:

```astro
---
import Tabs from '../components/Tabs.tsx';
---
<Tabs client:load items={tabData} />
```

### Animation libraries

- Lenis: use `client:only="react"` wrapper
- GSAP: inline `<script>` tag in the Astro component
- AOS: add `data-aos` attributes, init in `<script>` in Layout.astro

### Build + preview

```bash
npm run build
npm run preview
```

---

## Nuxt 3

**Best for:** Cloning Vue/Nuxt sites, SSR marketing sites.

### Setup

```bash
npx nuxi@latest init clone
cd clone
npm install
npx nuxi@latest module add tailwindcss
```

### File structure

```
components/
  sections/
    Hero.vue
    Features.vue
    FeatureCard.vue
  layout/
    Header.vue
    Footer.vue
pages/
  index.vue          ← assemble sections
app.vue              ← root (fonts, global providers)
assets/
  css/
    main.css         ← globals, tokens
public/
  images/
  fonts/
```

### Component template

```vue
<!-- components/sections/Hero.vue -->
<script setup lang="ts">
defineProps<{
  headline: string
  subheadline: string
  ctaText: string
  ctaHref: string
}>()
</script>

<template>
  <section class="hero">
    <h1>{{ headline }}</h1>
    <p>{{ subheadline }}</p>
    <a :href="ctaHref">{{ ctaText }}</a>
  </section>
</template>
```

### Page assembly

```vue
<!-- pages/index.vue -->
<template>
  <main>
    <Hero v-bind="heroData" />
    <Features :items="features" />
    <Footer />
  </main>
</template>
```

### Animation libraries

- Lenis: create `plugins/lenis.client.ts`
- GSAP: `npm install gsap`, use in `onMounted` hook
- Framer Motion: NOT available for Vue — use Motion One (`npm install motion`) instead

### Build

```bash
npm run build
npm run preview
```

---

## SvelteKit

**Best for:** Performance-sensitive sites, minimal bundle preference.

### Setup

```bash
npm create svelte@latest clone
# Choose: skeleton, TypeScript, ESLint, Prettier
cd clone
npm install
npx svelte-add@latest tailwindcss
```

### File structure

```
src/
  lib/
    components/
      sections/
        Hero.svelte
        Features.svelte
        FeatureCard.svelte
      layout/
        Header.svelte
        Footer.svelte
  routes/
    +layout.svelte    ← root layout (fonts, providers)
    +page.svelte      ← assemble sections
static/
  images/
  fonts/
```

### Component template

```svelte
<!-- src/lib/components/sections/Hero.svelte -->
<script lang="ts">
  export let headline: string;
  export let subheadline: string;
  export let ctaText: string;
  export let ctaHref: string;
</script>

<section class="hero">
  <h1>{headline}</h1>
  <p>{subheadline}</p>
  <a href={ctaHref}>{ctaText}</a>
</section>
```

### Animation

- Svelte has built-in `transition:` and `animate:` directives — use for simple animations
- GSAP: works normally in `onMount`
- Lenis: instantiate in `+layout.svelte` `onMount`

### Build

```bash
npm run build
npm run preview
```

---

## Vite + React (no Next.js)

**Best for:** Adding to existing React project, no SSR needed.

### Setup

```bash
npm create vite@latest clone -- --template react-ts
cd clone
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Key differences from Next.js

| Next.js | Vite + React |
|---------|-------------|
| `next/image` | `<img>` with manual width/height |
| `app/page.tsx` | `src/App.tsx` |
| `app/layout.tsx` | `src/main.tsx` (providers here) |
| `public/` | `public/` (same) |
| Server components | Client only — everything is `'use client'` |

### No file-based routing

Single page → `src/App.tsx` assembles sections directly.
Multi-page → add `react-router-dom`.

---

## Shopify Hydrogen

**Best for:** Ecommerce storefronts (product pages, collections, cart).

### Setup

```bash
npm create @shopify/hydrogen@latest clone
# Choose: hello-world template, TypeScript
```

### Key concepts

- Hydrogen is Remix-based — routes in `app/routes/`
- Product data from Storefront API (GraphQL)
- Use `<Image>` from `@shopify/hydrogen` for optimized images
- Cart via `useCart()` hook

### Scope warning

Hydrogen is complex. WebCloner for Shopify = **visual layer only**.
Use clone for: storefront layout, product card design, typography, colors.
Do NOT clone: checkout flow, payment processing, account pages.

---

## Switching Stacks Mid-Project

If user requests a stack change after spec files are written:
1. Specs are stack-agnostic — reuse them completely
2. Only the builder agent prompt changes (stack section)
3. Global tokens (colors, fonts, spacing) copy directly to any stack's equivalent globals file
4. Assets in `public/` are universal — no changes needed

Update Phase 4 builder prompt constraint line:
```
- Stack: [Astro / Nuxt 3 / SvelteKit / Vite+React] + TypeScript + Tailwind
```
Everything else in the prompt stays the same.
