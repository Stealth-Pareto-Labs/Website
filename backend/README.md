# Website intake setup

The Website posts to `/api/site-intake` (a same-origin Vercel function), which validates the form and forwards it to this Google Apps Script. Apps Script writes the HubSpot contact and form-specific note, logs to Sheets, notifies Slack, and optionally adds explicit newsletter opt-ins to a Resend audience. Requester receipts use Resend but stay disabled until both email drafts are approved.

## Vercel environment variables

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
3. Add the two Vercel environment variables and redeploy the Website preview.
4. Submit company and expert test entries with an authorized test address. Confirm each contact and its corresponding note in HubSpot, a row in the appropriate sheet tab, and the Slack notification.
5. Confirm with newsletter consent checked and unchecked that only checked test entries appear in the Resend audience.
6. Review both receipt drafts. Enable `ENABLE_RECEIPT_EMAILS` only after approval, then verify delivery to an authorized test inbox.

The existing newsletter signup uses the same Apps Script endpoint and remains separate from questionnaire submissions.
