# "Build with Pareto" form — backend setup (free, no SheetDB)

The site's contact form (modal + homepage inline form) posts to a **Google Apps Script web app** that:
1. writes each request to your **existing Google Sheet** (the same one SheetDB used), into the **"Early Access"** tab,
2. emails the requester a confirmation via **Resend**, and
3. posts a notification to **Slack**.

No SheetDB, no paid layer — Apps Script writes to the Google Sheet directly.

## What I need from you (paste into the Apps Script CONFIG, not the website repo)
- **`SHEET_ID`** — open your existing leads Google Sheet; copy the ID from the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
- **`SLACK_WEBHOOK`** — a Slack Incoming Webhook URL (reuse your existing Slack app — the `SLACK_WEBHOOK_EXPERTS` one).
- **`RESEND_API_KEY`** — your Resend key (`re_…`).
- **`FROM_EMAIL`** — a Resend‑verified sender. Default is `Pareto Labs <noreply@auth.trypareto.ai>`; change if you want a `build@`/`hello@` sender (must be verified in Resend).
- `NOTIFY_TEAM` is already `hello@trypareto.ai` (internal copy of each lead).

> Secrets live only inside your Apps Script project. The copy in this repo keeps them blank.

## Deploy (~3 min)
1. **script.google.com → New project** → paste in `build-request.gs` → fill CONFIG.
2. **Deploy → New deployment → ⚙ → Web app** → **Execute as: Me** → **Who has access: Anyone** → **Deploy** → **Authorize**.
3. Copy the **Web app URL** (ends in `/exec`).
4. **Send me that `/exec` URL** → I paste it into `assets/build-modal.js` → `BUILD_ENDPOINT` and redeploy the site. Live.

## Test
- Open the `/exec` URL in a browser → `{"ok":true,"service":"pareto-build-request"}`.
- After wiring, submit the form → confirmation email + Slack message + new "Early Access" row.

## Notes
- Front-end posts `application/x-www-form-urlencoded` with `mode:'no-cors'` (no CORS preflight). Apps Script reads `e.parameter`.
- `logToSheet_` is header-aware: it maps fields to whatever column headers your tab already has, so renaming the tab to "Build with Pareto" or adjusting columns won't break it.
- Email copy/branding lives in `emailRequester_()`.
