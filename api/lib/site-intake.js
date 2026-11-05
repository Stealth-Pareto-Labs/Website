const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 120, email: 254, company: 200, role: 120, challenge: 3000, current_role: 200, organization: 200, linkedin: 500, domain: 200, years_experience: 40, background: 3000 };
const COMPANY_ROLES = new Set(['Operating company (SMB / mid-market)', 'Developer / startup (inference)', 'Team deploying workloads (cloud)', 'Vertical / industry business', 'Government / public institution', 'Other']);
const EXPERIENCE_RANGES = new Set(['0–4', '5–10', '11–15', '16–20', '21+']);

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Please check your answers and try again.' };
  const type = input.formType === 'company' ? 'company' : input.formType === 'expert' ? 'expert' : '';
  if (!type) return { ok: false, error: 'This form could not be submitted.' };
  const submission = { type, submissionId: clean(input.submissionId, 100), name: clean(input.name, LIMITS.name), email: clean(input.email, LIMITS.email).toLowerCase(), page: clean(input.page, 300), newsletterConsent: input.newsletter_consent === true || input.newsletter_consent === 'true' };
  if (!submission.name || !EMAIL_RE.test(submission.email)) return { ok: false, error: 'Enter your name and a valid email address.' };
  if (type === 'company') {
    submission.company = clean(input.company, LIMITS.company);
    submission.role = clean(input.role, LIMITS.role);
    submission.challenge = clean(input.challenge, LIMITS.challenge);
    if (!submission.company || !submission.role || !submission.challenge || !COMPANY_ROLES.has(submission.role)) return { ok: false, error: 'Please complete all required fields.' };
  } else {
    submission.current_role = clean(input.current_role, LIMITS.current_role);
    submission.organization = clean(input.organization, LIMITS.organization);
    submission.linkedin = clean(input.linkedin, LIMITS.linkedin);
    submission.domain = clean(input.domain, LIMITS.domain);
    submission.years_experience = clean(input.years_experience, LIMITS.years_experience);
    submission.background = clean(input.background, LIMITS.background);
    if (!submission.current_role || !submission.domain || !submission.years_experience || !submission.background || !EXPERIENCE_RANGES.has(submission.years_experience)) return { ok: false, error: 'Please complete all required fields.' };
    if (submission.linkedin) {
      try {
        const url = new URL(submission.linkedin);
        if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'www.linkedin.com' && url.hostname.toLowerCase() !== 'linkedin.com' || !url.pathname.startsWith('/in/')) throw new Error('invalid');
      } catch (_) { return { ok: false, error: 'Enter a valid LinkedIn profile URL or leave it blank.' }; }
    }
  }
  return { ok: true, submission };
}

function serverEnv(env) {
  return env || (typeof process !== 'undefined' ? process.env : {});
}

async function postToAppsScript(fields, env, fetchImpl, failureMessages) {
  if (!env.APPS_SCRIPT_URL || !env.SITE_INTAKE_SHARED_SECRET) return { status: 503, body: { ok: false, error: failureMessages.unavailable } };
  let target;
  try { target = new URL(env.APPS_SCRIPT_URL); } catch (_) { return { status: 503, body: { ok: false, error: failureMessages.unavailable } }; }
  if (target.protocol !== 'https:' || target.hostname !== 'script.google.com') return { status: 503, body: { ok: false, error: failureMessages.unavailable } };
  try {
    const response = await fetchImpl(target.toString(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ shared_secret: env.SITE_INTAKE_SHARED_SECRET, ...fields }), redirect: 'follow' });
    if (!response.ok) throw new Error('Apps Script returned HTTP ' + response.status);
    const data = await response.json();
    if (!data || data.ok !== true) return { status: 502, body: { ok: false, error: failureMessages.rejected } };
    return { status: 201, body: data };
  } catch (_) { return { status: 502, body: { ok: false, error: failureMessages.failed } }; }
}

export async function handleSubmission(input, options = {}) {
  const validated = validateSubmission(input);
  if (!validated.ok) return { status: 400, body: { ok: false, error: validated.error } };
  const env = serverEnv(options.env);
  const s = validated.submission;
  const fields = { form: s.type === 'company' ? 'company_inquiry' : 'expert_application', submission_id: s.submissionId, name: s.name, email: s.email, page: s.page, newsletter_consent: s.newsletterConsent ? 'true' : 'false' };
  if (s.type === 'company') Object.assign(fields, { company: s.company, type: s.role, challenge: s.challenge });
  else Object.assign(fields, { current_role: s.current_role, organization: s.organization, linkedin: s.linkedin, domain: s.domain, years_experience: s.years_experience, background: s.background });
  const result = await postToAppsScript(fields, env, options.fetchImpl || globalThis.fetch, {
    unavailable: 'The form is temporarily unavailable. Please try again later.',
    rejected: 'We could not save your request. Please try again.',
    failed: 'We could not send your request. Please try again.',
  });
  if (result.status !== 201) return result;
  const data = result.body;
  return { status: 201, body: { ok: true, emailStatus: data.emailStatus || 'awaiting_approval', newsletterStatus: data.newsletterStatus || 'not_requested' } };
}

export async function handleNewsletter(input, options = {}) {
  const email = clean(input && input.email, LIMITS.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return { status: 400, body: { ok: false, error: 'Please enter a valid email address.' } };
  const result = await postToAppsScript({ form: 'newsletter', email, page: clean(input.page, 300) }, serverEnv(options.env), options.fetchImpl || globalThis.fetch, {
    unavailable: 'The subscription form is temporarily unavailable. Please try again later.',
    rejected: 'We could not add you to the update list. Please try again.',
    failed: 'We could not add you to the update list. Please try again.',
  });
  return result.status === 201 ? { status: 201, body: { ok: true } } : result;
}

export async function handleSiteIntakeRequest(request, env, fetchImpl = globalThis.fetch) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8' };
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) return new Response(JSON.stringify({ ok: false, error: 'Content-Type must be application/json.' }), { status: 415, headers });
  let input;
  try { input = await request.json(); } catch (_) { return new Response(JSON.stringify({ ok: false, error: 'Please check your answers and try again.' }), { status: 400, headers }); }
  const result = input && input.formType === 'newsletter'
    ? await handleNewsletter(input, { env, fetchImpl })
    : await handleSubmission(input, { env, fetchImpl });
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}
