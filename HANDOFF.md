# Handoff: trypareto.ai, branch `industries-mining-and-hide-three`

**Repo:** `C:\Users\josep\Website`. Nine commits ahead of `main`, **nothing pushed**.
The branch name is older than its contents: it now also carries the Infrastructure
pages, the Private Equity removal, the design round, and a repair to every
background video. Rename it before opening a PR.

**The gate:** `python -s scripts/check-site.py` from the repo root. 24 pages,
22 extra checks. It must print `all checks passed` before anything ships.

---

## 1. The bug that mattered

Every one of the twelve background videos was corrupt on `main`'s successor
commits, and the symptom was the owner's complaint that "the streaming is not
smooth, they shake".

`core.autocrlf=true` is set system-wide on this machine. Each mp4 was committed
with every `\r\n` collapsed to a bare `\n`, which cost the file between 4 and 31
bytes and shifted every byte offset after the first loss. The H.264 length
prefixes then pointed into the middle of other NAL units. Chrome decoded three to
ten frames of a hundred and froze on them.

This survived three rounds of review because **a still screenshot of a broken
video looks perfect**: the poster renders, the first frame decodes, and the page
screenshots clean. Only playing it shows the fault.

Proven rather than guessed: each repo file was byte-for-byte the clean master
with `\r\n -> \n` applied, and `ffprobe -count_frames` read 4 of `vid-telecom`'s
107.

Three things now stop it recurring:

1. `.gitattributes` declares every media extension `binary`. Text is deliberately
   left undeclared, because this repo is a mix of CRLF and LF HTML and an `eol`
   rule would renormalize every file into a whole-file diff.
2. `check_media()` in `scripts/check-site.py` walks each mp4's sample table and
   confirms the length prefixes chain exactly to the sample sizes. It was watched
   to fail on a deliberately re-collapsed `vid-hero.mp4`.
3. After any media change, confirm the staged blob equals the working tree:
   `git cat-file blob $(git rev-parse :path) | cmp - path`.

**If you add or regenerate a video, play it in a browser.** `ffprobe`'s frame
count alone is not enough; `nb_frames` reads the container's claim, and
`-count_frames` is what actually decodes.

---

## 2. What the two rebuilt components are

### The end-cap (`assets/newsletter.js`, `assets/newsletter.css`)

Two references, both measured off the live sites rather than described.

The ghost wordmark is legalpareto.com: an oversized serif at
`rgba(20,18,15,0.085)`, `clamp(82px,19.5vw,300px)`, bleeding off the right edge,
closed by a hairline, on the same cream field as the footer.

Underneath it is the reveal from **legora.com/product/skills** (the page the owner
pointed at; it is not on the Legora home page, which is why two earlier searches
missed it). Their hero holds a full-bleed canvas of monospace characters and
lights only the ones near the pointer. Values read off the live page by
instrumenting `CanvasRenderingContext2D.prototype.fillText`:

| | Legora | ours |
|---|---|---|
| font | `15px "JetBrains Mono"…` | `15px ui-monospace…` |
| column pitch | 9px | 8.25px (its own mono, measured at runtime) |
| row pitch | 22.5px | 22.5px |
| reveal disc | 126 x 112px | 116 x 113px |
| settled alpha | flat 0.100 | flat 0.100 |
| leading edge | brighter, to ~0.20 | +0.13, decays at 0.86/frame |
| trail gone by | ~900ms | ~700ms |
| ink | `rgba(0,80,50,a)`, their green | `rgba(44,60,96,a)`, `--ac` slate |

What the grid spells is the point. Legora's is an actual skill file, so the thing
under their page is their product. Ours is the platform runbook, in `SHEET` in
`newsletter.js`: edit that constant to change what the cursor uncovers. It is
word-wrapped to the measured column count and repeated until the band is full.

Guards: the canvas is removed entirely under `prefers-reduced-motion` or
`(hover: none)`, is `aria-hidden` and `pointer-events: none`, and the rAF loop
stops when nothing is left fading. The band is re-laid-out by a `ResizeObserver`
and on `document.fonts.ready`, because at injection time the wordmark's `clamp()`
has not resolved and the grid would otherwise be five rows deep in a 545px band.

### Pareto OS (`index.html`, `.osx*`, `assets/paretoos.js`)

**Legora's aOS is a pre-rendered mp4, scrubbed by scroll.** Inspected over CDP:
their section holds one video, 1920x1245, `autoplay:false`, `loop:false`, inside
a 4968px `track`, and its `currentTime` is driven by scroll position (0 to 11.03s
across the section). There is no canvas, no SVG and no CSS 3D anywhere on that
page. A baked film buys them photoreal refraction and costs them a multi-megabyte
download, a fixed resolution and text that cannot be restyled.

Ours is live WebGL instead, on the same pattern the sensor viewer already uses
(three.js 0.160.1 from jsDelivr, dynamically imported on intersection). Seven
rounded glass slabs land one per scroll beat, the one that just landed carries a
gold cut edge and the only legible label, and a frosted case closes over the
whole stack at the end, which is the beat the owner noticed on the reference.

Two things that are deliberate and will look wrong if "fixed": the slabs do not
use `transmission`, and neither does the case. The section is black, so a
transmissive material samples a black backdrop and the glass goes to mud; worse,
three.js excludes other transmissive meshes from that backdrop, so a stack of
them shows nothing through itself. Low-opacity `MeshPhysicalMaterial` with a
strong clearcoat, bright procedural studio environment and explicit
`renderOrder` is what makes glass read on black: edges and speculars.

It degrades to the CSS deck still in the markup under reduced motion, below
1000px, or with no WebGL; `.osx-has-gl` hides that deck only once the canvas is
actually up.

### The old CSS deck

Legora's aOS is not a hover list. It is a **scroll-pinned sequence**: a 5670px
section with a sticky inner frame, capsules that open one at a time as you
scroll, and a panel assembling alongside. Ours is a 560vh section, `.osx-pin`
sticky at 100vh, seven glass capsules driven off scroll progress, and seven
plates stacking in CSS 3D (`perspective: 1400px`, `rotateX(52deg) rotateZ(-38deg)`)
with the live layer in gold. One rAF-throttled scroll read.

The capsules are as wide as their own labels and open to 480px, which is what
Legora does (theirs measure 159 to 221px closed, 480 x 126 open; ours 131 to 213
closed, 440 x 101..122 open, the 440 being the column). Getting there needed
`.osx-body { width: 0 }` when closed: the hidden description was contributing to
the capsule's intrinsic width and making every pill identical.

Below 1000px the section unpins, every pill opens, the deck and the close
affordance are hidden.

---

## 3. Settled constraints, do not undo

- **Gold on dark, slate on cream.** Gold (`--sig #C8AE7D`) measures 9.11:1 on ink
  and **1.92:1 on cream**, where it never passed. Cream uses `--ac #2C3C60`
  (9.77:1); dark accents may use `--ac-d #92A4C2` (7.72:1). Both fail below ~80%
  opacity, so use them at full opacity. `check_gold()` reads each rule's owning
  selector to enforce this. The `.sx-*` sensor markers and the industries.html
  orbit illustration keep gold deliberately: illustration, not UI.
- **No em dashes in copy.** 215 removed in the first pass, the last 59 (both
  research essays plus the legal pages) in this one, each judged individually.
  Only `private-equity.html` is still exempt, and it is unreachable.
- **No pricing, no internal region codes, no "Abidjan", no NVIDIA, no roadmap or
  future-tense language** on the infrastructure pages and the homepage.
- **"Emerging markets" is replaced** by "sovereign infrastructure and AI".
- The platform reads as open to any developer, not enterprise-only.
- Every page carrying the long footer must load `newsletter.js`, or it has no
  end-cap. `check_endcap()` enforces it; `industries.html` was the one that
  silently did not.

---

## 4. Media spec

24fps, 1920x1080, no audio, 0.4 to 1.8MB, poster cut from the clip's own first
frame at 1600x900. Grade inside luma 40 to 101, saturation 6 to 29.

Generated with ElevenLabs Veo: `POST https://api.elevenlabs.io/v1/flows/video`,
`model_id: "veo-3.1-generate-001"`, `resolution: "4K"` (capital K),
`enhance_prompt: true` (it rejects `false`). Key at
`C:\Users\josep\.pareto-secrets\elevenlabs-api-key.txt`. Downsample 4K to 1080p
with lanczos; it measures better than a native 1080p encode and is smaller.

**Veo returns 2.35:1 with pure black bars baked in.** Measure before encoding
and crop them, or they ship into the hero and the card art. `vid-mining.mp4` and
`mining.jpg` both did.

**Veo also returns clips with a camera cut inside them.** A hard angle change
mid-clip is invisible in a still and survives every integrity check, but a
looping background that flips angle every few seconds reads as a glitch. Detect
it before shipping:

```
ffprobe -v error -f lavfi -i "movie=CLIP.mp4,select=gt(scene\,0.25)" \
  -show_entries frame=pts_time:frame_tags=lavfi.scene_score -of csv=p=0
```

Anything it prints is a cut. `vid-manufacturing` (0.40 at 1.875s) and
`vid-logistics` (0.33 at 1.833s) both had one and were rebuilt: keep the longest
cut-free run **from the start of the clip** (so frame zero, and therefore the
poster and the homepage card art, do not change), slow it with
`setpts=2.0*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1` to win
the duration back, then re-loop with `seamless.sh`. Both came out shorter but
better on every other axis: manufacturing 4.46s/1.11MB/seam 0.918 to
3.33s/0.47MB/seam 0.951, logistics 4.46s/1.44MB/seam 0.813 to
3.25s/0.47MB/seam 0.878, and the worst frame-to-frame jump measured in the
browser fell from 48.5 to 7.8 and from 41.1 to 4.3. Interpolation was checked on
the welding sparks, the hardest case, with no ghosting.

Loop seams: `scratchpad/seamless.sh <master> <out> <T> <d> <crf>` builds
`body + xfade(tail, head)` so the clip ends on the frame it starts on. Seams were
0.16 to 0.58 SSIM before, 0.71 to 0.99 now. **A longer crossfade measures worse**,
tested at d = 0.75, 1.00 and 1.25 on vid-cloud; 0.5 stands.

---

## 5. Open, and why

1. **`api.trypareto.ai` in `inference.html` is a placeholder.** The docs say the
   gateway is `api.<APPS_DOMAIN>` and the console is `console.pareto.ci`. The
   owner has to confirm the real hostname. `check_api_host()` allows it today.
2. **Every catalogue variant is `status: "untested"`** in the platform's
   `models.json`, while the pages speak in the present tense. The owner confirmed
   the platform is live; worth a second look before launch.
3. **Oil & Gas has no video of its own.** `industries/oil-gas.html` and
   `industries.html` both use the generic `assets/industries/hero.mp4` behind an
   oil-and-gas poster, which is a 0.36 SSIM handover: the poster and the footage
   are different scenes. Manufacturing, Telecom and Mining have dedicated clips.
4. **The industry posters have drifted** from their clips' first frames (0.65 to
   0.94) because the seamless rebuild moved frame zero. They double as the card
   art on the homepage, so recutting them changes the cards. Left as a design
   call. `assets/infra/hero.jpg` was poster-only and has been recut (0.74 to 0.99).
5. **Nav contrast.** Measured properly: `--wi2` on the cream bar is 5.05:1 and
   index.html's 0.6-opacity rule is 4.69:1 on cream, 6.20:1 on ink. Both pass AA.
   An earlier note claiming 3.90:1 was measuring the nav transparent over a bright
   patch of hero video, before it gains its background.
6. **Two retired clips still carry a camera cut**, `vid-consumer-brands-retail`
   (0.43 at 2.333s) and `vid-legal` (0.27 at 2.333s). Both pages are
   307-redirected and not reachable, so they were left alone. Rebuild them the
   same way if those industries ever come back.
7. **Mixed line endings.** `index.html`, `industries.html` and `industries/*.html`
   are CRLF; `assets/*`, `sitemap.xml` and the rest are LF. Preserve each file's
   existing endings after any scripted edit, or a four-line change shows up as a
   whole-file diff.

---

## 6. Tooling

Headless Chromium is already installed (Playwright's, no npm needed):
`C:/Users/josep/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`

Scripts live in the session scratchpad and drive it over CDP with Node's built-in
WebSocket. Each spawns its own `python -m http.server` on a private port, so
nothing has to be running first.

| script | what it does |
|---|---|
| `endcap-test.mjs` | the end-cap's pitch, disc, alpha and trail decay, measured |
| `osxmeasure.mjs` | capsule widths and heights at two scroll positions |
| `overflow.mjs` | horizontal overflow at 1440 / 1024 / 768 / 390, names the element |
| `vidplay.mjs` | plays each video in Chrome, reports decoded, dropped and corrupted frames |
| `pdiff.mjs` | finds cursor-reactive regions on any page by diffing frames |
| `canv.mjs`, `falloff.mjs` | instrument a page's canvas to read its drawing values |
| `ec-pages.mjs` | the end-cap across pages, viewports and reduced-motion |
| `seamless.sh` | the loop-seam rebuild |

Two traps worth keeping:

- `html { scroll-behavior: smooth }` defeats a synthetic `window.scrollTo`, so
  scroll reveals never fire and the page looks broken in screenshots. Set
  `document.documentElement.style.scrollBehavior='auto'` and use
  `scrollTo({top, behavior:'instant'})`.
- Screenshots taken before the 0.8s `.rv` fade completes make cream look grey.
  Settle first, or you will chase a colour bug that does not exist.
