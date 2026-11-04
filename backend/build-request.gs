/* Pareto Labs website intake endpoint. Configure all secrets in Script Properties. */
var PROP = PropertiesService.getScriptProperties();
var SHEET_ID = PROP.getProperty('SHEET_ID') || '';
var SLACK_WEBHOOK = PROP.getProperty('SLACK_WEBHOOK') || '';
var SLACK_MENTION = PROP.getProperty('SLACK_MENTION') || '';
var SLACK_BOT_TOKEN = PROP.getProperty('SLACK_BOT_TOKEN') || '';
var SLACK_DM_USERS = PROP.getProperty('SLACK_DM_USERS') || '';
var HUBSPOT_ACCESS_TOKEN = PROP.getProperty('HUBSPOT_ACCESS_TOKEN') || '';
var SITE_INTAKE_SHARED_SECRET = PROP.getProperty('SITE_INTAKE_SHARED_SECRET') || '';
var RESEND_API_KEY = PROP.getProperty('RESEND_API_KEY') || '';
var RESEND_AUDIENCE_ID = PROP.getProperty('RESEND_AUDIENCE_ID') || '';
var FROM_EMAIL = PROP.getProperty('FROM_EMAIL') || 'Pareto Labs <noreply@auth.trypareto.ai>';
var ENABLE_RECEIPT_EMAILS = PROP.getProperty('ENABLE_RECEIPT_EMAILS') === 'true';

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    if (p.form === 'newsletter') {
      if (!SITE_INTAKE_SHARED_SECRET || !constantTimeEqual_(p.shared_secret || '', SITE_INTAKE_SHARED_SECRET)) return json_({ ok: false, code: 'unauthorized' });
      var newsletterEmail = trim_(p.email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) return json_({ ok: false, code: 'invalid_email' });
      subscribeNewsletter_(newsletterEmail, trim_(p.page));
      return json_({ ok: true });
    }
    if (!SITE_INTAKE_SHARED_SECRET || !constantTimeEqual_(p.shared_secret || '', SITE_INTAKE_SHARED_SECRET)) return json_({ ok: false, code: 'unauthorized' });
    var form = p.form || '';
    if (form !== 'company_inquiry' && form !== 'expert_application') return json_({ ok: false, code: 'invalid_form' });
    var lead = normalizeLead_(p, form);
    var validation = validateLead_(lead);
    if (validation) return json_({ ok: false, code: 'invalid_submission', message: validation });
    if (!HUBSPOT_ACCESS_TOKEN) return json_({ ok: false, code: 'hubspot_not_configured' });
    if (!lead.submissionId || !/^[A-Za-z0-9_-]{8,100}$/.test(lead.submissionId)) return json_({ ok: false, code: 'invalid_submission_id' });
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    var cached = PROP.getProperty('intake_' + lead.submissionId);
    if (cached) {
      var previous = {};
      try { previous = JSON.parse(cached); } catch (ignored) { previous = {}; }
      lock.releaseLock();
      return json_({ ok: true, emailStatus: 'already_processed', newsletterStatus: previous.newsletterStatus || 'already_processed', duplicate: true });
    }
    var contactId, newsletterStatus = 'not_requested';
    try {
      contactId = upsertHubSpotContact_(lead);
      createHubSpotNote_(lead, contactId);
      if (p.newsletter_consent === 'true') {
        if (!RESEND_AUDIENCE_ID) {
          newsletterStatus = 'not_configured';
          console.error('Newsletter consent received but RESEND_AUDIENCE_ID is not configured.');
        } else {
          try { addResendAudienceContact_(lead); newsletterStatus = 'subscribed'; }
          catch (audienceError) { newsletterStatus = 'failed'; console.error('Resend audience add failed: ' + String(audienceError)); }
        }
      }
      PROP.setProperty('intake_' + lead.submissionId, JSON.stringify({ contactId: contactId, newsletterStatus: newsletterStatus }));
    } finally {
      lock.releaseLock();
    }
    try { logToSheet_(lead); } catch (sheetError) { console.error('Website intake sheet logging failed: ' + String(sheetError)); }
    try { notifySlack_(lead); } catch (slackError) { console.error('Website intake Slack notification failed: ' + String(slackError)); }
    var emailStatus = 'awaiting_approval';
    if (ENABLE_RECEIPT_EMAILS) {
      try {
        if (!RESEND_API_KEY) throw new Error('Resend is enabled but RESEND_API_KEY is missing.');
        sendReceipt_(lead);
        emailStatus = 'sent';
      } catch (emailError) {
        console.error('Website intake Resend receipt failed: ' + String(emailError));
        emailStatus = 'failed';
      }
    }
    return json_({ ok: true, emailStatus: emailStatus, newsletterStatus: newsletterStatus });
  } catch (err) {
    console.error('Website intake failed: ' + String(err));
    return json_({ ok: false, code: 'processing_failed' });
  }
}

function doGet() { return json_({ ok: true, service: 'pareto-site-intake' }); }

function normalizeLead_(p, form) {
  var expert = form === 'expert_application';
  return {
    form: form, submissionId: trim_(p.submission_id), name: trim_(p.name), email: trim_(p.email).toLowerCase(),
    company: trim_(expert ? p.organization : p.company), role: trim_(expert ? p.current_role : p.type),
    challenge: trim_(expert ? p.background : p.challenge), page: trim_(p.page), ts: new Date(),
    domain: trim_(p.domain), years: trim_(p.years_experience), linkedin: trim_(p.linkedin),
    organization: trim_(p.organization), currentRole: trim_(p.current_role),
    newsletterConsent: p.newsletter_consent === 'true'
  };
}

function validateLead_(lead) {
  if (!lead.name || lead.name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) || lead.email.length > 254) return 'Invalid name or email.';
  var companyRoles = ['Operating company (SMB / mid-market)', 'Developer / startup (inference)', 'Team deploying workloads (cloud)', 'Vertical / industry business', 'Government / public institution', 'Other'];
  if (lead.form === 'company_inquiry' && (!lead.company || companyRoles.indexOf(lead.role) === -1 || !lead.challenge)) return 'Missing company inquiry fields.';
  if (lead.form === 'expert_application') {
    if (!lead.role || !lead.domain || ['0–4', '5–10', '11–15', '16–20', '21+'].indexOf(lead.years) === -1 || !lead.challenge) return 'Missing expert questionnaire fields.';
    if (lead.linkedin && !/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?(?:\?.*)?$/.test(lead.linkedin)) return 'Invalid LinkedIn profile URL.';
  }
  return '';
}

function upsertHubSpotContact_(lead) {
  var name = lead.name.split(/\s+/);
  var props = { email: lead.email, firstname: name.shift() || '', lastname: name.join(' ') };
  if (lead.company) props.company = lead.company;
  if (lead.form === 'expert_application' && lead.role) props.jobtitle = lead.role;
  var response = hubspotFetch_('/crm/v3/objects/contacts/batch/upsert', 'post', {
    inputs: [{ id: lead.email, idProperty: 'email', properties: props }]
  });
  if (response.status >= 400) throw new Error('HubSpot contact upsert failed (' + response.status + ').');
  var body = JSON.parse(response.body || '{}');
  var result = (body.results && body.results[0]) || body;
  if (!result.id) throw new Error('HubSpot did not return a contact ID.');
  return String(result.id);
}

function createHubSpotNote_(lead, contactId) {
  var lines = [lead.form === 'company_inquiry' ? 'Website company inquiry' : 'Website expert application', 'Name: ' + lead.name, 'Email: ' + lead.email];
  if (lead.company) lines.push('Company / organization: ' + lead.company);
  if (lead.role) lines.push(lead.form === 'company_inquiry' ? 'Role: ' + lead.role : 'Current role: ' + lead.role);
  if (lead.domain) lines.push('Domain: ' + lead.domain);
  if (lead.years) lines.push('Years of experience: ' + lead.years);
  if (lead.linkedin) lines.push('LinkedIn: ' + lead.linkedin);
  lines.push('Newsletter updates: ' + (lead.newsletterConsent ? 'explicitly opted in' : 'not opted in'));
  lines.push(lead.form === 'company_inquiry' ? 'What they want to build or improve:' : 'Expertise background:', lead.challenge, 'Source page: ' + lead.page, 'Submission ID: ' + lead.submissionId);
  var response = hubspotFetch_('/crm/v3/objects/notes', 'post', {
    properties: { hs_timestamp: String(lead.ts.getTime()), hs_note_body: escapeHtml_(lines.join('\n')).replace(/\n/g, '<br>') },
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }]
  });
  if (response.status >= 400) throw new Error('HubSpot note creation failed (' + response.status + ').');
}

function hubspotFetch_(path, method, payload) {
  var response = UrlFetchApp.fetch('https://api.hubapi.com' + path, {
    method: method, contentType: 'application/json', headers: { Authorization: 'Bearer ' + HUBSPOT_ACCESS_TOKEN },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return { status: response.getResponseCode(), body: response.getContentText() };
}

function logToSheet_(lead) {
  if (!SHEET_ID) throw new Error('SHEET_ID is not configured.');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tab = lead.form === 'company_inquiry' ? 'Leads Website' : 'Expert Requests';
  var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  var headers = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var defaults = ['Timestamp', 'Submission ID', 'Name', 'Email', 'Company / Organization', 'Role', 'Domain', 'Years Experience', 'LinkedIn', 'Challenge / Background', 'Newsletter Consent', 'Page'];
  var map = {
    'timestamp': lead.ts, 'date': lead.ts, 'submission id': lead.submissionId,
    'name': lead.name, 'full name': lead.name, 'email': lead.email, 'work email': lead.email,
    'company': lead.company, 'organization': lead.company, 'company / organization': lead.company,
    'role': lead.role, 'you are': lead.role, 'type': lead.role, 'current role': lead.role,
    'domain': lead.domain, 'primary domain': lead.domain,
    'years experience': lead.years, 'years of experience': lead.years,
    'linkedin': lead.linkedin, 'linkedin profile': lead.linkedin,
    'challenge': lead.challenge, 'challenge / background': lead.challenge,
    'where could ai help your operations?': lead.challenge, 'message': lead.challenge, 'background': lead.challenge,
    'newsletter consent': lead.newsletterConsent ? 'yes' : 'no',
    'page': lead.page, 'source': lead.page
  };
  if (!headers.length || !String(headers[0]).trim()) {
    sh.appendRow(defaults);
    headers = defaults;
  } else {
    ['Submission ID', 'Newsletter Consent'].forEach(function (requiredHeader) {
      var exists = headers.some(function (header) { return String(header).trim().toLowerCase() === requiredHeader.toLowerCase(); });
      if (!exists) {
        sh.getRange(1, headers.length + 1).setValue(requiredHeader);
        headers.push(requiredHeader);
      }
    });
  }
  sh.appendRow(headers.map(function (header) {
    var key = String(header).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '';
  }));
}

function subscribeNewsletter_(email, page) {
  if (!RESEND_AUDIENCE_ID || !RESEND_API_KEY) throw new Error('Resend audience is not configured.');
  addResendNewsletterContact_(email);
  if (SHEET_ID) {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName('Newsletter') || ss.insertSheet('Newsletter');
    if (sh.getLastRow() === 0) sh.appendRow(['Timestamp', 'Email', 'Page']);
    sh.appendRow([new Date(), email, page || '']);
  }
  if (SLACK_WEBHOOK) SLACK_WEBHOOK.split(',').forEach(function (url) { url = url.trim(); if (url) UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ text: '📰 New newsletter subscriber: ' + email + (page ? '  (' + page + ')' : '') }), muteHttpExceptions: true }); });
}

function addResendNewsletterContact_(email, firstName) {
  var response = UrlFetchApp.fetch('https://api.resend.com/audiences/' + encodeURIComponent(RESEND_AUDIENCE_ID) + '/contacts', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + RESEND_API_KEY },
    payload: JSON.stringify({ email: email, first_name: firstName || undefined, unsubscribed: false }), muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300 && code !== 409) throw new Error('Resend audience API returned ' + code + '.');
}

function addResendAudienceContact_(lead) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is missing.');
  var first = lead.name.split(/\s+/)[0] || lead.name;
  addResendNewsletterContact_(lead.email, first);
}

function sendReceipt_(lead) {
  var first = lead.name.split(/\s+/)[0] || lead.name;
  var isExpert = lead.form === 'expert_application';
  var title = isExpert ? 'Thank you for your interest in Pareto Labs' : 'We received your message — Pareto Labs';
  var body = isExpert
    ? 'We have received your expert network questionnaire. Our team will review your experience and follow up if there is a fit for upcoming work.'
    : 'We have received your message. Our team reviews each inquiry and will be in touch within two business days.';
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1b1a17;max-width:560px;margin:32px auto;padding:36px;border:1px solid #e8e3d9;background:#fffdf9"><p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a8854f">PARETO LABS</p><h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400;line-height:1.2">Thank you, ' + escapeHtml_(first) + '.</h1><p style="font-size:15px;line-height:1.7;color:#55524c">' + escapeHtml_(body) + '</p><p style="font-size:14px;line-height:1.7;color:#55524c">You can reply to this email if you would like to add anything.</p><p style="border-top:1px solid #e8e3d9;padding-top:20px;font-size:13px;color:#777">The Pareto Labs team · <a href="https://www.trypareto.ai" style="color:#a8854f">trypareto.ai</a></p></div>';
  var payload = { from: FROM_EMAIL, to: [lead.email], subject: title, html: html };
  var result = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Idempotency-Key': 'site-intake-' + lead.submissionId },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  if (result.getResponseCode() < 200 || result.getResponseCode() >= 300) throw new Error('Resend receipt failed (' + result.getResponseCode() + ').');
}

function notifySlack_(lead) {
  if (!SLACK_WEBHOOK && !SLACK_BOT_TOKEN) return;
  var title = lead.form === 'company_inquiry' ? 'New company inquiry' : 'New expert network application';
  var text = title + ': ' + lead.name;
  var blocks = [
    { type: 'header', text: { type: 'plain_text', text: title } },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: '*Name:*\n' + lead.name },
      { type: 'mrkdwn', text: '*Email:*\n' + lead.email },
      { type: 'mrkdwn', text: '*Company / organization:*\n' + (lead.company || '—') },
      { type: 'mrkdwn', text: '*Role:*\n' + (lead.role || '—') },
      { type: 'mrkdwn', text: '*Domain:*\n' + (lead.domain || '—') },
      { type: 'mrkdwn', text: '*Years of experience:*\n' + (lead.years || '—') }
    ] },
    { type: 'section', text: { type: 'mrkdwn', text: '*Details:*\n' + (lead.challenge || '—') } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'from ' + (lead.page || '/') + ' · ' + lead.ts }] }
  ];
  var mention = SLACK_MENTION ? '<@' + SLACK_MENTION.trim() + '> ' : '';
  if (SLACK_WEBHOOK) SLACK_WEBHOOK.split(',').forEach(function (url) { url = url.trim(); if (url) UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ text: mention + text, blocks: blocks }), muteHttpExceptions: true }); });
  if (SLACK_BOT_TOKEN && SLACK_DM_USERS) SLACK_DM_USERS.split(',').forEach(function (id) { id = id.trim(); if (id) slackDM_(id, mention + text, blocks); });
}

function slackDM_(userId, text, blocks) {
  var headers = { Authorization: 'Bearer ' + SLACK_BOT_TOKEN };
  var open = UrlFetchApp.fetch('https://slack.com/api/conversations.open', { method: 'post', contentType: 'application/json', headers: headers, payload: JSON.stringify({ users: userId }), muteHttpExceptions: true });
  var data = JSON.parse(open.getContentText());
  if (data.ok && data.channel && data.channel.id) UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', { method: 'post', contentType: 'application/json', headers: headers, payload: JSON.stringify({ channel: data.channel.id, text: text, blocks: blocks }), muteHttpExceptions: true });
}

function constantTimeEqual_(a, b) { if (a.length !== b.length) return false; var result = 0; for (var i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
function trim_(value) { return String(value || '').trim(); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function escapeHtml_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
