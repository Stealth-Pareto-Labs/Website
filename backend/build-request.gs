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
var SHEET_TAB      = 'Leads Website';                // the tab in your Google Sheet (created automatically if missing)
var SLACK_WEBHOOK  = '';    // one or more Slack Incoming Webhook URLs, comma-separated
var SLACK_MENTION  = '';    // optional: your Slack member ID to @mention you (e.g. 'U0123ABCD')
var SLACK_BOT_TOKEN = '';   // optional: xoxb-… bot token to ALSO DM you in your Slack inbox
var SLACK_DM_USERS  = '';   // optional: comma-separated member IDs to DM (e.g. 'U0123ABCD')
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
    '<!doctype html><html><body style="margin:0;padding:0;background:#EFEAE0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAE0;"><tr><td align="center" style="padding:32px 16px;">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F7F4EE;border:1px solid #E2DCCE;">' +
        '<tr><td style="font-size:0;line-height:0;height:4px;background:#A8854F;">&nbsp;</td></tr>' +
        '<tr><td style="padding:38px 46px 0 46px;">' +
          '<div style="font-family:Georgia,serif;font-size:21px;font-weight:bold;color:#14120F;">Pareto&nbsp;Labs</div>' +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9a8e78;margin-top:7px;">Continuous-Learning AI</div>' +
        '</td></tr>' +
        '<tr><td style="padding:30px 46px 0 46px;">' +
          '<h1 style="margin:0;font-family:Georgia,serif;font-size:31px;font-weight:normal;line-height:1.2;color:#14120F;">Thank you, ' + escapeHtml_(first) + '.</h1>' +
        '</td></tr>' +
        '<tr><td style="padding:20px 46px 0 46px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#4a463f;">' +
          '<p style="margin:0 0 16px;">We&rsquo;ve received your request to build with Pareto. Every inquiry is reviewed personally by our team &mdash; not a queue, not an auto-responder &mdash; and we&rsquo;ll be in touch within <strong style="color:#14120F;">two business days</strong>.</p>' +
          '<p style="margin:0;">In that first conversation we&rsquo;ll learn how your operations actually run and where continuous-learning AI can create measurable value, tailored to your business.</p>' +
        '</td></tr>' +
        '<tr><td style="padding:30px 46px 0 46px;">' +
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9a8e78;border-top:1px solid #E2DCCE;padding-top:24px;">What happens next</div>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">' +
            '<tr><td width="36" valign="top" style="font-family:Georgia,serif;font-size:15px;color:#A8854F;padding:10px 0;">01</td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4a463f;padding:10px 0;">We review your request and the operations you described.</td></tr>' +
            '<tr><td width="36" valign="top" style="font-family:Georgia,serif;font-size:15px;color:#A8854F;padding:10px 0;border-top:1px solid #EDE8DC;">02</td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4a463f;padding:10px 0;border-top:1px solid #EDE8DC;">We reach out within two business days to understand your goals.</td></tr>' +
            '<tr><td width="36" valign="top" style="font-family:Georgia,serif;font-size:15px;color:#A8854F;padding:10px 0;border-top:1px solid #EDE8DC;">03</td><td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4a463f;padding:10px 0;border-top:1px solid #EDE8DC;">We scope the highest-ROI AI for your operations &mdash; and how it improves over time.</td></tr>' +
          '</table>' +
        '</td></tr>' +
        '<tr><td style="padding:28px 46px 0 46px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#4a463f;">' +
          '<p style="margin:0;">If you&rsquo;d like to add anything before we speak, just reply to this email.</p>' +
          '<p style="margin:16px 0 0;color:#14120F;">&mdash; The Pareto Labs team</p>' +
        '</td></tr>' +
        '<tr><td style="padding:30px 46px 38px 46px;">' +
          '<div style="border-top:1px solid #E2DCCE;padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9a8e78;">' +
            '<a href="https://www.trypareto.ai" style="color:#A8854F;text-decoration:none;">trypareto.ai</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="mailto:hello@trypareto.ai" style="color:#A8854F;text-decoration:none;">hello@trypareto.ai</a>' +
            '<div style="margin-top:8px;">Continuous-learning AI for real-world operations.</div>' +
          '</div>' +
        '</td></tr>' +
      '</table>' +
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b3a890;margin-top:16px;">&copy; 2026 Pareto Labs, Inc.</div>' +
    '</td></tr></table></body></html>';

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
  if (!SLACK_WEBHOOK && !SLACK_BOT_TOKEN) return;
  var mention = SLACK_MENTION ? '<@' + SLACK_MENTION.trim() + '> ' : '';
  var blocks = [
    { type: 'header', text: { type: 'plain_text', text: '🛠  New “Build with Pareto” request' } }
  ];
  if (mention) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: mention + '— a new lead just came in.' } });
  }
  blocks.push(
    { type: 'section', fields: [
      { type: 'mrkdwn', text: '*Name:*\n' + (lead.name || '—') },
      { type: 'mrkdwn', text: '*Work email:*\n' + (lead.email || '—') },
      { type: 'mrkdwn', text: '*Company:*\n' + (lead.company || '—') },
      { type: 'mrkdwn', text: '*You are:*\n' + (lead.type || '—') }
    ]},
    { type: 'section', text: { type: 'mrkdwn', text: '*Where AI can help:*\n' + (lead.challenge || '—') } },
    { type: 'context', elements: [ { type: 'mrkdwn', text: 'from ' + (lead.page || '/') + ' · ' + lead.ts } ] }
  );
  var fallback = 'New “Build with Pareto” request from ' + (lead.name || 'someone');

  // 1) Post to channel webhook(s)
  if (SLACK_WEBHOOK) {
    var payload = JSON.stringify({ text: mention + fallback, blocks: blocks });
    SLACK_WEBHOOK.split(',').forEach(function (url) {
      url = url.trim();
      if (url) UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true });
    });
  }

  // 2) Direct-message user(s) in their Slack inbox (needs a bot token)
  if (SLACK_BOT_TOKEN && SLACK_DM_USERS) {
    SLACK_DM_USERS.split(',').forEach(function (uid) {
      uid = uid.trim();
      if (uid) slackDM_(uid, fallback, blocks);
    });
  }
}

function slackDM_(userId, text, blocks) {
  var channel = userId;
  try { // open the DM channel (needs im:write); fall back to raw user id
    var open = UrlFetchApp.fetch('https://slack.com/api/conversations.open', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN },
      payload: JSON.stringify({ users: userId }), muteHttpExceptions: true
    });
    var data = JSON.parse(open.getContentText());
    if (data.ok && data.channel && data.channel.id) channel = data.channel.id;
  } catch (e) {}
  UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN },
    payload: JSON.stringify({ channel: channel, text: text, blocks: blocks }), muteHttpExceptions: true
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
