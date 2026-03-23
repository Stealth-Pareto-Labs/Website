# Pareto Labs — trypareto.ai

Production website for [trypareto.ai](https://trypareto.ai).

## File Structure

```
index.html          ← Main landing page
experts.html        ← Expert application page
participants.html   ← Research participant sign-up page
assets/
  style.css         ← Shared design system (CSS variables, reset, shared components)
```

All three HTML files import `assets/style.css` for shared design tokens. Page-specific styles live in `<style>` blocks inside each HTML file.

---

## Deploy to Vercel (Recommended)

### Option 1 — Drag & Drop (fastest)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Select **"Deploy a folder"** or drag the entire `Website/` folder into the deploy zone
4. Vercel will detect it as a static site automatically
5. Click **Deploy**

### Option 2 — GitHub Integration (recommended for ongoing updates)

1. Push this repo to GitHub (already done if you're reading this)
2. Go to [vercel.com](https://vercel.com) → **Add New → Project**
3. Import the `Stealth-Pareto-Labs/Website` repository
4. Framework Preset: **Other** (static site, no build step needed)
5. Output Directory: leave blank (root)
6. Click **Deploy**

### Custom Domain

1. In Vercel project settings → **Domains**
2. Add `trypareto.ai` and `www.trypareto.ai`
3. Update your DNS records as instructed by Vercel (typically CNAME or A records)

---

## Replace Formspree IDs

The forms use placeholder Formspree endpoints. Before going live, replace them:

1. Create a free account at [formspree.io](https://formspree.io)
2. Create three separate forms (or one shared form) and copy the form IDs

### index.html — Contact form
```html
<!-- Replace YOUR_CONTACT_FORM_ID -->
<form action="https://formspree.io/f/YOUR_CONTACT_FORM_ID" ...>
```

### experts.html — Expert application form
```html
<!-- Replace YOUR_EXPERT_FORM_ID -->
<form action="https://formspree.io/f/YOUR_EXPERT_FORM_ID" ...>
```

### participants.html — Participant sign-up form
```html
<!-- Replace YOUR_PARTICIPANT_FORM_ID -->
<form action="https://formspree.io/f/YOUR_PARTICIPANT_FORM_ID" ...>
```

After replacing, search for `YOUR_` to confirm no placeholders remain.

---

## External Dependencies (CDN)

All loaded via CDN — no build step, no npm install required:

| Library | Purpose |
|---|---|
| Cormorant Garamond + Outfit | Display and body typography |
| Lucide | Icons throughout (nav, forms, features, confirmations) |
| GSAP 3.12.2 | Hero entrance animations |
| GSAP ScrollTrigger | Scroll-triggered section reveals |

---

## Design System

Core tokens defined in `assets/style.css`:

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#09090B` | Page backgrounds |
| `--bg-surface` | `#111115` | Section backgrounds |
| `--bg-elevated` | `#18181D` | Form sections, elevated cards |
| `--text-primary` | `#F2EFE8` | Headlines, primary content |
| `--text-secondary` | `#9A9890` | Body copy, descriptions |
| `--text-muted` | `#5C5A56` | Labels, meta, footnotes |
| `--accent` | `#C8831A` | CTAs, active states, highlights only |
| `--font-display` | Cormorant Garamond | All headlines |
| `--font-body` | Outfit | All body copy, UI |

---

## Contact

joseph@trypareto.ai
