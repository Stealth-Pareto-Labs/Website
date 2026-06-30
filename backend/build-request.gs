/**
 * Pareto Labs — "Build with Pareto" request handler (Google Apps Script).
 * Free backend: writes each request to your existing Google Sheet, emails the
 * requester a confirmation (via Resend), and posts a Slack notification.
 *
 * SETUP (see backend/README.md):
 *   1. script.google.com → New project → paste this file in.
 *   2. Fill the CONFIG values below (these live only in YOUR Apps Script
 *      project — never commit real keys to the website repo).
 *   3. Deploy → New deployment → "Web app" → Execute as: Me →
 *      Who has access: "Anyone" → Deploy → Authorize.
 *   4. Send the resulting /exec URL to paste into BUILD_ENDPOINT in
 *      /assets/build-modal.js.
 */

// ───────────────────────── CONFIG ─────────────────────────
var SHEET_ID       = '';   // the existing Google Sheet ID (from its URL: /spreadsheets/d/THIS/edit)
var SHEET_TAB      = 'Early Access';                 // existing tab; rename to "Build with Pareto" anytime
var SLACK_WEBHOOK  = '';    // Slack Incoming Webhook URL (reuse your existing Slack app)
var RESEND_API_KEY = '';    // Resend API key (re_...) — paste here, not in the website repo
var FROM_EMAIL     = 'Pareto Labs <noreply@auth.trypareto.ai>';  // a Resend-verified sender
var NOTIFY_TEAM    = 'hello@trypareto.ai';           // internal copy of each lead ('' = skip)
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

/* Header-aware append: maps fields to whatever columns the tab already has. */
function logToSheet_(lead) {
  if (!SHEET_ID) return;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_TAB) || ss.insertSheet(SHEET_TAB);
  var lastCol = sh.getLastColumn();
  var headers = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var map = {
    'timestamp': lead.ts, 'date': lead.ts,
    'name': lead.name, 'full name': lead.name,
    'email': lead.email, 'work email': lead.email,
    'company': lead.company, 'organization': lead.company,
    'role': lead.type, 'you are': lead.type, 'type': lead.type,
    'company size': '', 'size': '',
    'challenge': lead.challenge, 'where could ai help your operations?': lead.challenge, 'message': lead.challenge,
    'page': lead.page, 'source': lead.page
  };
  if (headers.length && String(headers[0]).trim() !== '') {
    var row = headers.map(function (h) {
      var key = String(h).trim().toLowerCase();
      return (key in map) ? map[key] : '';
    });
    sh.appendRow(row);
  } else {
    sh.appendRow(['Timestamp', 'Name', 'Email', 'Company', 'Type', 'Challenge', 'Page']);
    sh.appendRow([lead.ts, lead.name, lead.email, lead.company, lead.type, lead.challenge, lead.page]);
  }
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

  sendEmail_(lead.email, subject, html, NOTIFY_TEAM);

  if (NOTIFY_TEAM) {
    var teamHtml =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#222;">' +
      '<p><strong>New “Build with Pareto” request</strong></p>' +
      '<p>Name: ' + escapeHtml_(lead.name) + '<br>Email: ' + escapeHtml_(lead.email) +
      '<br>Company: ' + escapeHtml_(lead.company) + '<br>You are: ' + escapeHtml_(lead.type) +
      '<br>Page: ' + escapeHtml_(lead.page) + '</p>' +
      '<p><em>Where AI can help:</em><br>' + escapeHtml_(lead.challenge).replace(/\n/g, '<br>') + '</p></div>';
    sendEmail_(NOTIFY_TEAM, 'New Build request: ' + lead.name + (lead.company ? ' (' + lead.company + ')' : ''), teamHtml, lead.email);
  }
}

/* Resend if a key is set; otherwise fall back to Apps Script MailApp. */
function sendEmail_(to, subject, html, replyTo) {
  if (RESEND_API_KEY) {
    var payload = { from: FROM_EMAIL, to: [to], subject: subject, html: html };
    if (replyTo) payload.reply_to = replyTo;
    UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + RESEND_API_KEY },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
  } else {
    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Pareto Labs', replyTo: replyTo || undefined });
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
