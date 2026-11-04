# Website Company and Expert Intake Design

## Intent

Let prospective companies and domain experts submit a short questionnaire directly on trypareto.ai. Send each submission to HubSpot, preserve the Website's existing Google Sheet and Slack notifications, send an approved Resend receipt, and show the existing Pareto social links after successful submission.

## Goals

- Replace the last primary navigation action with **For companies** and **For developers**. The company action scrolls to the homepage questionnaire; the developer action links to `https://factory.trypareto.ai/`.
- Keep the company questionnaire on the homepage and make its required fields explicit and validated.
- Put a concise public expert questionnaire on `experts.html`. All Website expert CTAs lead to it; no Website expert CTA or success state links to the expert portal.
- Use one server-side intake path for company and expert forms. HubSpot stores a contact and a form-specific note; the existing sheet and Slack path stays in place.
- Show a clear success state with Discord, LinkedIn, X, and Instagram links.
- Keep provider credentials server-side. Send receipts through Resend only after the user approves the templates.

## Non-goals

- Do not change the separate expert portal, account creation, onboarding, or approval behavior.
- Do not subscribe applicants to a marketing audience without explicit consent.
- The existing newsletter signup remains an explicit subscription action and must add the address to the configured Resend audience before confirming success.
- Do not redesign unrelated sections or touch existing uncommitted Website work.

## Approved approach

Use a small same-origin Vercel function as a response-aware proxy to the existing Google Apps Script handler. The browser posts JSON to `/api/site-intake`; the function validates the envelope, forwards form data with a server-side shared secret, follows the Apps Script Content Service redirect, and returns a trustworthy success or error. Apps Script validates again and remains the single coordinator for HubSpot, Resend, Sheets, and Slack. This preserves current delivery paths without duplicating integrations in a second backend.

## Form scope

- Company required fields: name, work email, company, role selection, and what to build or improve.
- Expert required fields: name, email, current role, primary domain/industry, years of experience, and a concise expertise summary. Organization and LinkedIn are optional; a provided LinkedIn value must be a valid HTTPS URL.
- Both questionnaires offer an optional, unchecked newsletter consent checkbox. Only checked submissions enter the Resend audience, and consent is recorded in the HubSpot note and Sheet row.
- Both form types are distinguished in HubSpot notes and spreadsheet logging. The expert questionnaire is public intake only and does not create a portal account.

## Email and failure behavior

- Draft one short Resend receipt per form type and leave live sending disabled until both templates are approved.
- HubSpot contact/note persistence determines whether the request is accepted. If Resend fails after persistence, report the received request without asking the user to resubmit, log the email failure for team follow-up, and use the same Resend idempotency key for retries.
- If HubSpot fails, show a retryable error. Do not display success for an unrecorded request.

## Remaining implementation calls

- Use the current configured Resend sender after verifying it is available to the Apps Script project.
- Keep existing internal Sheet/Slack notifications for both submission types; log expert applications in a separate `Expert Requests` tab so existing company columns remain stable.
- Use the existing Website release gate, `python -s scripts/check-site.py`, plus focused Node tests for the proxy and Apps Script handler.
