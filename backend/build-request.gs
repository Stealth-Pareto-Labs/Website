/**
 * Pareto Labs — "Build with Pareto" request handler (Google Apps Script).
 * Free backend: logs each request to a Google Sheet, emails the requester a
 * confirmation, and posts a notification to Slack.
 *
 * SETUP (see backend/README.md for the full walkthrough):
 *   1. Create a standalone Apps Script project (script.google.com → New project).
 *   2. Paste this file in. Fill the CONFIG values below.
 *   3. Deploy → New deployment → type "Web app" → Execute as: Me →
 *      Who has access: "Anyone" → Deploy. Authorize when prompted.
 *   4. Copy the Web app URL (…/exec) into BUILD_ENDPOINT in
 *      /assets/build-modal.js, then redeploy the site.
 */

// ───────────────────────── CONFIG ─────────────────────────
var SHEET_ID     = '';                       // optional Google Sheet ID to log leads ('' = skip)
var SHEET_TAB    = 'Build Requests';
var SLACK_WEBHOOK = '';                      // Slack Incoming Webhook URL (reuse your existing Slack app)
var NOTIFY_TEAM  = 'hello@trypareto.ai';     // internal copy of each lead ('' = skip)
var FROM_NAME    = 'Pareto Labs';
// ───────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var lead = {
      name:      (p.name || '').trim(),
      email:     (p.email || '').trim(),
      company:   (p.company || '').trim(),
      type:      (p.type || '').trim(),
      challenge: (p.challenge || '').trim(),
      page:      (p.page || '').trim(),
      ts:        new Date()
    };
    if (lead.name && lead.email) {
      logToSheet_(lead);
      emailRequester_(lead);
      notifySlack_(lead);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() { return json_({ ok: true, service: 'pareto-build-request' }); }

function logToSheet_(lead) {
  if (!SHEET_ID) return;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_TAB);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TAB);
    sh.appendRow(['Timestamp', 'Name', 'Email', 'Company', 'Type', 'Challenge', 'Page']);
  }
  sh.appendRow([lead.ts, lead.name, lead.email, lead.company, lead.type, lead.challenge, lead.page]);
}

function emailRequester_(lead) {
  var first = (lead.name.split(' ')[0] || lead.name);
  var subject = 'We received your request — Pareto Labs';
  var html =
    '<div style="font-family:Georgia,\'Times New Roman\',serif;color:#14120F;max-width:520px;margin:0 auto;padding:8px 4px;">' +
      '<p style="font-size:19px;margin:0 0 18px;">Thank you, ' + escapeHtml_(first) + '.</p>' +
      '<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:#3a3833;margin:0 0 14px;">' +
        'We&rsquo;ve received your request to build with Pareto. Our team reviews every inquiry personally and will be in touch within <strong>two business days</strong> to learn more about your operations and where continuous-learning AI can help.' +
      '</p>' +
      '<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.75;color:#3a3833;margin:0 0 22px;">If you&rsquo;d like to add anything in the meantime, just reply to this email.</p>' +
      '<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6A6760;border-top:1px solid #e6e1d6;padding-top:16px;margin:0;">&mdash; The Pareto Labs team<br><a href="https://www.trypareto.ai" style="color:#A8854F;text-decoration:none;">trypareto.ai</a></p>' +
    '</div>';
  MailApp.sendEmail({ to: lead.email, subject: subject, htmlBody: html, name: FROM_NAME, replyTo: NOTIFY_TEAM || undefined });

  if (NOTIFY_TEAM) {
    var body = [
      'Name: ' + lead.name,
      'Email: ' + lead.email,
      'Company: ' + lead.company,
      'You are: ' + lead.type,
      'Page: ' + lead.page,
      '',
      'Where AI can help:',
      lead.challenge
    ].join('\n');
    MailApp.sendEmail({
      to: NOTIFY_TEAM,
      subject: 'New Build request: ' + lead.name + (lead.company ? ' (' + lead.company + ')' : ''),
      body: body,
      replyTo: lead.email || undefined
    });
  }
}

function notifySlack_(lead) {
  if (!SLACK_WEBHOOK) return;
  var payload = {
    text: 'New “Build with Pareto” request from ' + (lead.name || 'someone'),
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🛠  New “Build with Pareto” request' } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: '*Name:*\n' + (lead.name || '—') },
        { type: 'mrkdwn', text: '*Work email:*\n' + (lead.email || '—') },
        { type: 'mrkdwn', text: '*Company:*\n' + (lead.company || '—') },
        { type: 'mrkdwn', text: '*You are:*\n' + (lead.type || '—') }
      ]},
      { type: 'section', text: { type: 'mrkdwn', text: '*Where AI can help:*\n' + (lead.challenge || '—') } },
      { type: 'context', elements: [ { type: 'mrkdwn', text: 'from ' + (lead.page || '/') + ' · ' + lead.ts } ] }
    ]
  };
  UrlFetchApp.fetch(SLACK_WEBHOOK, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
