# Website Intake Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add direct company and expert intake forms to trypareto.ai, connected to HubSpot and Resend, with accessible confirmation and social links.

**Architecture:** A same-origin Vercel function validates and proxies form submissions to the existing Apps Script. Apps Script performs HubSpot upsert/note, keeps the existing Sheet/Slack behavior, and sends approved Resend receipts.

**Tech Stack:** Static HTML/CSS/JavaScript, Vercel Node.js Function, Google Apps Script, HubSpot CRM API, Resend API, Python site checks, Node built-in tests.

**Spec:** `docs/superpowers/specs/2026-11-04-website-intake-design.md`

## Global Constraints

- Do not modify the original dirty checkout at `C:\Users\josep\Website`.
- Do not add provider credentials to tracked source, client JavaScript, or logs.
- Do not send Resend receipts until the user approves both templates.
- Do not link Website expert CTAs to `expert.trypareto.ai` or change that separate portal.
- Preserve the existing company Sheet and Slack notification behavior.
- Do not add submissions to a marketing audience without explicit opt-in.

## Review Focus

- Invalid or incomplete requests sent directly to the API must be rejected server-side.
- Provider errors must not show a false success state.
- A HubSpot-success/Resend-failure result must not prompt a duplicate CRM submission.
- Repeated form submit clicks must not create duplicate emails.
- Company navigation must scroll to the inline form rather than open the legacy modal.
- Expert links, including the confirmation state, must not send visitors to the portal.

### Task 1: Intake validation and server-side proxy

**Files:** create `api/site-intake.js`, `api/lib/site-intake.js`, `scripts/site-intake.test.mjs`; modify `backend/build-request.gs`.

- [x] Write failing Node tests for company/expert validation, newsletter forwarding, proxy configuration, and Apps Script result handling.
- [x] Run `node --test scripts/site-intake.test.mjs` and verify failures are due to missing implementation.
- [x] Implement the Vercel proxy and server-side validation. Require `APPS_SCRIPT_URL` and `SITE_INTAKE_SHARED_SECRET`; never expose the secret to the browser.
- [x] Extend Apps Script to verify the shared secret, validate each form type, upsert HubSpot contacts, attach form-specific notes, preserve header-aware company logging, add expert logging to its own sheet tab, and notify Slack.
- [x] Read integration credentials from Apps Script Script Properties. Add a receipt-enabled flag that defaults off until copy approval.
- [x] Check Resend response status, use per-submission idempotency keys, and report email failure without undoing an already-recorded CRM request.
- [x] Run `node --test scripts/site-intake.test.mjs` and verify all focused tests pass.

### Task 2: Navigation, forms, and confirmation states

**Files:** modify `index.html`, `experts.html`, `work-with-us.html`, `assets/build-modal.js`, `assets/build-modal.css`, `assets/site.css`, and `scripts/check-site.py` as needed.

- [x] Add site-check assertions for navigation actions, direct company anchor, required fields, social links, and absence of expert-portal links.
- [x] Add **For companies** and **For developers** after Research on the shared navigation, with both actions accessible on mobile.
- [x] Route company links directly to the inline form and remove the legacy modal submit handler.
- [x] Add the expert questionnaire to `experts.html` and route Website expert CTAs to its anchor.
- [x] Add client-side validation, loading/error/success states, and social links to both success screens.
- [x] Move the existing newsletter form through the same response-aware endpoint and Resend audience, preserving consent-first behavior.
- [x] Run `python -s scripts/check-site.py` and verify the new checks pass.

### Task 3: Receipt approval and integration verification

**Files:** create `docs/email-templates/website-company-receipt.md` and `docs/email-templates/website-expert-receipt.md`; update Website setup notes if required.

- [x] Write concise branded receipt drafts with no marketing-list subscription language.
- [ ] Verify Vercel and Apps Script deployment configuration without printing secret values; the current worktree has no Vercel intake env vars or Apps Script CLI credential.
- [x] Run the local focused tests and `python -s scripts/check-site.py`.
- [ ] Test provider behavior with mocks, then perform a controlled HubSpot create/note/delete smoke test after secure deployment settings are available.
- [ ] Keep live Resend receipt sending disabled until the user approves both drafts. After approval and configuration, verify delivery to an authorized test inbox.

