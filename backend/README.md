# Website intake setup

The Website posts to `/api/site-intake` (a same-origin function), which validates the form and forwards it to this Google Apps Script. Apps Script writes the HubSpot contact and form-specific note, logs to Sheets, notifies Slack, and optionally adds explicit newsletter opt-ins to a Resend audience. Requester receipts use Resend but stay disabled until both email drafts are approved.

## Cloudflare Pages

The Website can be built and deployed from the repository root with Wrangler. `scripts/build-pages.mjs` creates an allowlisted `dist/` output; the Pages Function lives in `functions/api/site-intake.js` and uses the shared validation module in `api/lib/site-intake.js`.

1. Build and deploy a preview branch:

   ```sh
   node scripts/build-pages.mjs
   wrangler pages deploy dist --project-name trypareto-website --branch cloudflare-preview
   ```

2. Add `APPS_SCRIPT_URL` and `SITE_INTAKE_SHARED_SECRET` as Cloudflare Pages Functions variables/secrets. The shared secret must exactly match the Apps Script Script Property. Do not put either value in this repository or a client-side file.
3. Keep `ENABLE_RECEIPT_EMAILS` unset or `false` in Apps Script until both drafts in `docs/email-templates/` are approved.
4. Submit company and expert test inquiries with an authorized test address. Confirm a HubSpot contact and matching note, Sheet row, Slack notification, and the opted-in Resend audience record before attaching production domains.
5. Add `www.trypareto.ai` and `trypareto.ai` through the Pages project's Custom Domains settings, and configure the apex-to-www redirect. The current Wrangler token cannot read DNS records or edit zone settings, so this domain step requires Cloudflare dashboard access or a token with the required zone permissions.
6. Enable Cloudflare Web Analytics for the Pages project. Vercel Insights tags are omitted from the Pages output; analytics will remain inactive until Cloudflare Web Analytics is enabled.

Direct uploads are manual deployments. Each release must run the build and `wrangler pages deploy` command again. The production domain must remain on its current host until preview checks and the live intake smoke test pass.

## Vercel environment variables (while Vercel remains active)

Set these for the Website project in Vercel. The matching shared secret must also be set in Apps Script Script Properties.

- `APPS_SCRIPT_URL` — deployed Apps Script web app URL ending in `/exec`.
- `SITE_INTAKE_SHARED_SECRET` — a random secret shared only by Vercel and Apps Script.

## Apps Script Script Properties

Open the Apps Script project that owns the existing `/exec` endpoint, then **Project Settings → Script Properties**. Add:

- `SITE_INTAKE_SHARED_SECRET` — same value as Vercel.
- `HUBSPOT_ACCESS_TOKEN` — private app token with contact read/write and note create/association access.
- `SHEET_ID` — existing intake spreadsheet ID.
- `SLACK_WEBHOOK` — optional comma-separated incoming webhook URLs.
- `SLACK_MENTION`, `SLACK_BOT_TOKEN`, `SLACK_DM_USERS` — optional Slack notifications.
- `RESEND_API_KEY` — Resend API key; required for receipts or audience opt-ins.
- `RESEND_AUDIENCE_ID` — audience ID. Configure this before release because the questionnaire forms offer an optional newsletter opt-in; only checked submissions are added.
- `FROM_EMAIL` — verified sender, for example `Pareto Labs <noreply@auth.trypareto.ai>`.
- `ENABLE_RECEIPT_EMAILS` — keep unset or `false` until both drafts in `docs/email-templates/` are approved; set `true` only after approval.

Do not put credential values into this repository. Apps Script returns an error to the Website if HubSpot is not configured, so a submission is never reported as successful before the contact and note are stored. Sheet, Slack, audience, and receipt errors are logged server-side after CRM success. If an opted-in submission cannot be added to Resend, the confirmation page tells the visitor.

## Deploy and verify

1. Update the existing Apps Script project with `build-request.gs` and configure Script Properties.
2. Deploy a new version of the existing web app as **Execute as: Me** and **Who has access: Anyone**. Keep the current `/exec` URL if possible.
3. Add the two Vercel environment variables and redeploy the Website preview, or configure them on Cloudflare Pages before its live intake test.
4. Submit company and expert test entries with an authorized test address. Confirm each contact and its corresponding note in HubSpot, a row in the appropriate sheet tab, and the Slack notification.
5. Confirm with newsletter consent checked and unchecked that only checked test entries appear in the Resend audience.
6. Review both receipt drafts. Enable `ENABLE_RECEIPT_EMAILS` only after approval, then verify delivery to an authorized test inbox.

The existing newsletter signup uses the same Apps Script endpoint and remains separate from questionnaire submissions.
