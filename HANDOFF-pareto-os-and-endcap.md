# Handoff: Pareto OS section and the Pareto Labs end-cap

**Repo:** `C:\Users\josep\Website` (git). Branch `industries-mining-and-hide-three`,
head `7671029`. Nothing is pushed.

**Status: two components are rejected by the owner and need redoing.** Everything
else on the branch is accepted. Read this whole file before editing; the second half
lists the tooling that already exists so you do not rebuild it.

---

## 1. What the owner asked for, verbatim

Round one:

> Also do you think you can do something like what legora has in Page 2 introducing
> the legora OS anywhere on our product […] Also go to https://legalpareto.com/ and
> see the last the end of the company in the end right before these […] see when you
> hover on the name it unhide some small text. Legora had the same on their website
> that unhide small letters. Do the same for our mai Pareto Labs website bellow down
> before the footers […] It was not Pro at all and gold color also make the site look
> to AI generated, so go deep and find the best color that match the design and be
> creative with what we see when we hover. I like the mutiple letters that Harvey
> shows but be creative and find what works best for us.

Round two, after my attempt:

> Introducing Pareto OS (good title), but it is completely different from what legora
> has. Please study well the legora OS part […] and make the same. It should be apple
> glass clear like this and very very amazing design do an amazing job here please […]
> Also Th epareto labs undernath before footers is very bad, definitely what I want,
> please double check what I asked even the for https://legalpareto.com/fr/ is better

Round three, after my second attempt:

> Extremelly bad job you missed everything I said regarding Pareto Labs before footer
> and the Pareto OS part.

**Two attempts have been rejected. Do not assume my reading of the brief is correct.**
Open the two reference pages yourself and compare against the live local build before
you design anything. The gap is evidently something I am not seeing.

---

## 2. Current implementation (what you are replacing)

### Pareto OS

| | |
|---|---|
| Markup | `index.html`, section `<div class="section-dark os-sec" id="how">` |
| CSS | `index.html` inline `<style>`, block starting `/* ── PARETO OS: glass layers over the machines ───── */` (~line 248) |
| Structure | `.os-sec` > `.os-bg` (video + `.os-veil`) + `.os-inner` > `.os-head-block` + `ul.os-stack` > 7 × `li.os-pill` |
| Each pill | `button.os-head` (`.os-n` number, `.os-name`, `.os-plus`) + `div.os-panel` > `div.os-panel-in` (`p` + optional `a.os-link`) |
| Open on | `:hover` and `:focus-within`, via `grid-template-rows: 0fr → 1fr` |
| Glass | `background: rgba(10,14,26,.46)`, `backdrop-filter: blur(22px) saturate(1.3)`, `border-radius: 26px`, 1px border at `rgba(238,233,224,.12)` |
| Cascade | `transform: translateX(calc(var(--i) * 7px))` so each pill steps right |
| Layers | 01 Sovereign compute · 02 Inference · 03 Cloud · 04 Company Brain · 05 Evidence loop · 06 Governance · 07 Industry systems. 01–03 carry `.os-own` and a gold numeral. |
| Background | `/assets/infra/vid-hero.mp4` under an 86/74/90% ink veil |

### The end-cap

| | |
|---|---|
| Markup | injected by `assets/newsletter.js`, inserted before `<footer>` on every page |
| CSS | `assets/newsletter.css`, block starting `/* ── END-CAP ──` (~line 41) |
| Structure | `section.plw` > `.plw-stage` > `.plw-eyebrow` + `.plw-swap` (`.plw-word` of per-letter `span.plw-l` **and** `.plw-layers`, same grid cell) + `.plw-tag` |
| Behaviour | on `:hover`/`:focus-within` the letters translateY(-26px) and fade out on a 24ms per-letter stagger while SILICON · INFERENCE · CLOUD · KNOWLEDGE · GOVERNANCE · WORKFLOW fade up in their place |
| Look | cream `--w` field continuous with the footer, wordmark `clamp(82px,19.5vw,300px)` at `rgba(20,18,15,0.085)`, bleeding off the right edge, hairline under `.plw-tag` |
| Touch | `@media (hover:none)` un-stacks them so both show |

---

## 3. Reference specs I measured (these are facts, not guesses)

Pulled from the live sites over CDP, so they are the real computed values.

**Legora aOS capsules** — `https://legora.com/`, the section headed *"Introducing the
Legora aOS™ / The agentic operating system for legal work"*:

```
background:        rgba(0, 0, 0, 0.5)
backdrop-filter:   blur(27.5px)
border-radius:     24px
border:            none
box-shadow:        none
collapsed:         height 40px, width fits content (159–221px)
expanded:          width 480px, height 126px, revealing a description
```

Seven capsules stacked vertically, left-aligned, over a large light panel that
carries the real visual (it did not render headless, so **check what that panel
actually is** — it may be a 3D render, a video, or an interactive diagram, and it may
be the thing the owner actually means by "apple glass clear"). Their seven layers:
Large Language Models · Agentic Harness · Data & Integrations · Context & Knowledge ·
Legal Capabilities · Products & Interfaces · Security & Governance. Each links to
`#aos1`…`#aos7`.

**Pareto Legal end-cap** — `https://legalpareto.com/` and `/fr/`:

A huge, very faint ghost wordmark sitting directly above the footer link columns on
the same white field. "PARETO" oversized, "LEGAL" smaller and offset right, **cropped
by the right edge**. A hairline under it, then three columns of links, then a thin
legal row. No dark band, no stage, no animation on load. Their `.finale` section does
have a hover rule — `.finale:hover .finale__folio { transform: rotate(0deg)
translateY(-5px); box-shadow: … }` — which rotates a card, **not** a text reveal.

Screenshots of all of this are in
`C:\Users\josep\AppData\Local\Temp\claude\C--Users-josep\7f7392e4-2973-4901-9a4c-ad25782e1128\scratchpad\shots\`:
`legora-aos.png`, `legora-pills.png`, `legora-bottom.png`, `lp-fr.png`,
`harvey-bottom.png`. They may be cleared when the session ends; regenerate with the
tooling below if so.

---

## 4. Where I think I went wrong (treat as hypotheses, not findings)

I do not know which of these is the real gap. Verify before acting.

1. **The owner may want the Legora *panel*, not just the capsules.** I built the pill
   list and put a video behind it. Legora's section is dominated by a large visual
   that the capsules sit on top of. If that panel is the point, the whole composition
   is wrong, not the pill styling.
2. **"Apple glass clear" may mean lighter, not darker.** Mine is dark glass on dark
   footage, so the blur has little to work against and reads as flat panels. Legora's
   capsules are dark glass on a *light* panel, which is what makes the glass legible.
3. **The end-cap hover may not be wanted at all.** The owner said Pareto Legal's is
   better, and Pareto Legal has no text reveal on its wordmark. I kept pushing a
   letters-lift effect from the round-one brief that may have been superseded.
4. **The end-cap may need the footer columns restructured**, not just a watermark
   above the existing single-row footer. Pareto Legal has three labelled columns
   (Plateforme / Entreprise / S'inscrire) under the wordmark; ours is one flat row of
   twelve links.

---

## 5. Constraints that still apply

From the owner, earlier in the same session. These are settled; do not undo them.

- **Gold on dark, slate on cream.** Gold (`--sig #C8AE7D`, `--gold #A8854F`) is
  correct on ink backgrounds and measures 9.11:1. On cream it measures **1.92:1** and
  must not be used. Cream uses `--ac #2C3C60`; dark text accents may use
  `--ac-d #92A4C2`. Both accents fail below ~80% opacity, so use them at full opacity.
- **No em dashes in body copy.** 215 were removed. The two research essays and the
  legal pages are exempt.
- **No pricing, no internal region codes (`ci-abj-*`), no "Abidjan", no NVIDIA, no
  roadmap or future-tense language** on the infrastructure pages and the homepage.
- **"Emerging markets" has been replaced** with "sovereign infrastructure and AI".
- The platform must read as open to any developer, not enterprise-only.

---

## 6. Tooling that already exists — use it, do not rebuild it

**`scripts/check-site.py`** is the gate. Run from the repo root:

```
python -s scripts/check-site.py        # 24 pages, 9 extra checks, must print "all checks passed"
```

It enforces: balanced markup, resolvable assets, nav/footer consistency, retired pages
staying unreachable, em dashes, gold-on-light, blocked model names, API host, and
Private Equity in the modal. **Keep it green.**

**Headless Chromium is installed** (Playwright's, no npm install needed):
`C:/Users/josep/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`

Scripts in the scratchpad directory above, all driven over CDP with Node's built-in
WebSocket:

| script | what it does |
|---|---|
| `shot.mjs <page> <width> <out>` | full-page screenshot with reveals settled |
| `hover.mjs <page> <out> [hover]` | screenshot the end-cap, optionally hovered |
| `hov2.mjs <scrollSel> <out> [hoverSel]` | screenshot any section, optionally hovering an element |
| `measure.mjs <pages…>` | horizontal overflow at 1440/1024/768/390, names the offending element |
| `rv.mjs` | counts `.rv` elements that never reveal |
| `section.mjs <url> <text> <out> [deep]` | finds a section on a public page by text, screenshots it, and with `deep` dumps computed background/blur/radius of its children |
| `inspect.mjs <url> <out>` | dumps the bottom-of-page elements and every `:hover` CSS rule |

**Two traps that cost me time:**

- `html { scroll-behavior: smooth }` defeats a synthetic `window.scrollTo`, so scroll
  reveals never fire and the page looks broken in screenshots. Set
  `document.documentElement.style.scrollBehavior='auto'` and use
  `scrollTo({top, behavior:'instant'})`.
- Screenshots taken before the 0.8s `.rv` fade completes make cream elements look
  grey. Settle first, or you will chase colour bugs that do not exist.

**Serving locally:** `python -s -m http.server 8080 --bind 127.0.0.1` from the repo
root. One may already be running on 8080.

**Line endings:** mixed across the repo (`index.html`, `industries.html` and
`industries/*.html` are CRLF; `assets/*`, `sitemap.xml`, `government.html` are LF).
After any scripted edit, normalise against `git show HEAD:<path>` or a four-line change
shows up as a whole-file diff.

**Media pipeline**, if new footage is needed. ElevenLabs key at
`C:\Users\josep\.pareto-secrets\elevenlabs-api-key.txt`. `POST
https://api.elevenlabs.io/v1/flows/video` with `model_id: "veo-3.1-generate-001"`,
`resolution: "4K"` (capital K), `enhance_prompt: true` (it rejects `false`), then
downsample 4K→1080p with lanczos, which measures better than a native 1080p encode at
a smaller file. House spec: **24fps, 5.04s, 121 frames, audio stripped, 0.4–1.8 MB**,
poster from the first frame at 1600×900, grade inside luma 40–101 / sat 6–29.

---

## 7. Definition of done

1. `python -s scripts/check-site.py` passes.
2. No horizontal overflow at 1440 / 1024 / 768 / 390 (`measure.mjs`).
3. Both components work by keyboard and under `prefers-reduced-motion`, and on touch
   where there is no hover.
4. Side-by-side screenshots of your build against `legora-aos.png` and `lp-fr.png`
   that a sceptical reader would call a match.
5. Gold/slate rule intact, no em dashes introduced.

**Ask the owner to look before you polish.** This has been rejected twice; a quick
screenshot check after the first rough pass is worth more than a finished second guess.
