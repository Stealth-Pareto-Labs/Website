# "Build with Pareto" form — backend setup (free, no SheetDB)

The site's contact form (modal + the homepage inline form) posts to a **Google Apps Script web app** that:
1. logs each request to a Google Sheet,
2. emails the requester a "we received your request" confirmation, and
3. posts a notification to Slack.

No paid services. Email is sent via Apps Script's built-in `MailApp` (from the Google/Workspace account that owns the script).

## One-time setup (~3 minutes)

1. Go to **script.google.com → New project**. Name it "Pareto – Build Requests".
2. Delete the default code, paste in **`build-request.gs`** (this folder).
3. Fill the **CONFIG** block at the top:
   - `SLACK_WEBHOOK` — a Slack **Incoming Webhook** URL. Reuse your existing Slack app (the one behind `SLACK_WEBHOOK_EXPERTS`): Slack → that app → *Incoming Webhooks* → copy an existing webhook or *Add New Webhook to Workspace* and pick the channel.
   - `SHEET_ID` — (optional) create a Google Sheet, copy the ID from its URL (`/spreadsheets/d/THIS_PART/edit`), paste it in. Leave `''` to skip logging.
   - `NOTIFY_TEAM` — already `hello@trypareto.ai` (sends your team a plain copy of each lead). Change or set `''` to skip.
4. **Deploy → New deployment → ⚙ → Web app**:
   - Description: anything
   - **Execute as: Me**
   - **Who has access: Anyone**
   - **Deploy**, then **Authorize access** (approve the Gmail/Sheets scopes).
5. Copy the **Web app URL** (ends in `/exec`).
6. Send me that URL (and confirm the Slack webhook is in place). I'll paste it into
   `assets/build-modal.js` → `BUILD_ENDPOINT` and redeploy. Done — fully live.

## Testing
- Visit the deployed `/exec` URL in a browser → should return `{"ok":true,"service":"pareto-build-request"}`.
- After wiring `BUILD_ENDPOINT`, submit the form on the site → you should get the confirmation email, a Slack message, and a new Sheet row.

## Notes
- The front-end posts `application/x-www-form-urlencoded` with `mode:'no-cors'` (no CORS preflight needed). Apps Script reads fields via `e.parameter`.
- To change copy/branding of the confirmation email, edit `emailRequester_()`.
- Daily email quota: 100/day on consumer Gmail, 1,500/day on Google Workspace — plenty for inbound leads.
