# Cloudflare Pages Migration Implementation Plan

> **For agentic workers:** Required sub-skill: `superpowers:executing-plans`.

**Goal:** Prepare and deploy a verified Cloudflare Pages preview for trypareto.ai while preserving the current Website and intake behavior.

**Architecture:** Produce a safe static artifact under `dist/`, use Cloudflare clean URLs in internal links and SEO metadata, reuse one shared intake implementation from both host adapters, and route only `/api/site-intake` through a Pages Function. Deploy to a preview branch with Wrangler; production custom domains and DNS remain gated on verified integrations and permissions.

**Tech Stack:** Static HTML/CSS/JS, Cloudflare Pages Functions, Wrangler, Node built-in tests, Python site checks.

**Spec:** `docs/superpowers/specs/2026-11-04-cloudflare-pages-migration.md`

## Global Constraints
- Do not deploy `api/`, `backend/`, `docs/`, `scripts/`, `supabase/`, or source-only files as static assets.
- Never embed provider credentials in source, client JavaScript, build output, or logs.
- Keep receipt sending disabled pending template approval.
- Preserve explicit newsletter consent and existing path redirects.
- Keep static page views outside Pages Function routes; Pages-native extensionless redirects preserve legacy `.html` request access.
- Do not attach production domains or modify production DNS until real intake smoke tests and required account access are verified.

## Review Focus
- Malformed JSON, wrong content type, non-POST method, missing environment bindings, and provider failure return clear non-success responses.
- Build artifact excludes source and secret-bearing directories while preserving media files.
- Pages routes invoke the function only for `/api/site-intake`.
- Retired paths retain 307 redirects, and HTML URLs follow Pages' built-in clean URL behavior.
- Cloudflare's `.html` to clean URL behavior does not leave canonical tags or sitemap URLs pointing at redirecting paths.
- Preview deployment cannot accidentally bind the production domain.

### Task 1: Create Pages artifact and routing contract
**Files:** create `scripts/build-pages.mjs`, `scripts/cloudflare-pages.test.mjs`, modify `.gitignore`.
- [x] Test the expected allowlisted artifact, exclusions, `_routes.json`, `_redirects`, 404 behavior, and clean URL metadata.
- [x] Run the focused test and verify it fails before implementation.
- [x] Implement the deterministic static copy and Pages routing files.
- [x] Run focused test, existing site checks, and verify the output tree.

### Task 2: Add a shared Pages Function adapter
**Files:** refactor `api/lib/site-intake.js` and `api/site-intake.js`; create `functions/api/site-intake.js`; update focused tests.
- [x] Test Pages request method, content type, malformed body, company/expert/newsletter handling, and Cloudflare `env` bindings.
- [x] Run focused test and verify it fails before implementation.
- [x] Refactor shared intake logic to one ESM module and adapt both hosts.
- [x] Run existing and new tests and verify both adapters share validation and response behavior.

### Task 3: Configure, preview, and deploy
**Files:** create `wrangler.toml`, update `backend/README.md` with Cloudflare setup and release gates, remove Vercel analytics tags from public HTML.
- [x] Verify Wrangler Pages local development behavior with the generated artifact and Function.
- [x] Create a Cloudflare Pages direct-upload project and deploy only a named preview branch.
- [x] Check homepage, nested pages, redirects, static assets, and API validation responses on `pages.dev`.
- [ ] Record required secrets/variables without setting guessed credentials; verify the live HubSpot path only after existing Apps Script settings are confirmed. Cloudflare preview currently returns 503 on a valid intake because its bindings are absent; Apps Script project access is not connected in this environment.
- [ ] Keep custom domains, DNS cutover, and analytics activation pending if account permissions or integration access are missing. Wrangler lacks DNS record read/write and Web Analytics permissions; the current production branch also remains `main` pending the open PR.

## Execution ruling

Cloudflare Pages automatically redirects `.html` requests to clean URLs. The migration converts internal links, canonical/OG URLs, and sitemap entries in the generated artifact; existing `.html` bookmarks still resolve through Pages' redirect behavior. A Pages Function is not added for static HTML routes, which would spend Workers request quota on ordinary page views.
