import assert from 'node:assert/strict';
import test from 'node:test';
import { handleNewsletter, handleSubmission, validateSubmission } from '../api/lib/site-intake.js';

const companySubmission = {
  formType: 'company',
  submissionId: 'company-request-1',
  name: 'James Wright',
  email: 'james@company.com',
  company: 'Example Company',
  role: 'Operating company (SMB / mid-market)',
  challenge: 'Improve customer service operations.',
};

const expertSubmission = {
  formType: 'expert',
  submissionId: 'expert-request-1',
  name: 'Taylor Expert',
  email: 'taylor@example.com',
  current_role: 'Operations Director',
  organization: 'Example Group',
  linkedin: 'https://www.linkedin.com/in/taylor-expert/',
  domain: 'Manufacturing',
  years_experience: '11–15',
  background: 'I have led manufacturing operations across multiple sites.',
};

test('validates and normalizes company inquiries', () => {
  const result = validateSubmission(companySubmission);
  assert.equal(result.ok, true);
  assert.equal(result.submission.type, 'company');
  assert.equal(result.submission.email, 'james@company.com');
});

test('rejects company inquiries with invalid emails or missing required answers', () => {
  assert.equal(validateSubmission({ ...companySubmission, email: 'bad' }).ok, false);
  assert.equal(validateSubmission({ ...companySubmission, role: '' }).ok, false);
  assert.equal(validateSubmission({ ...companySubmission, challenge: '   ' }).ok, false);
});

test('validates expert applications and accepts an omitted optional LinkedIn URL', () => {
  assert.equal(validateSubmission(expertSubmission).ok, true);
  assert.equal(validateSubmission({ ...expertSubmission, linkedin: '' }).ok, true);
  assert.equal(validateSubmission({ ...expertSubmission, linkedin: 'https://example.com/profile' }).ok, false);
});

test('passes newsletter consent only when the visitor explicitly checks it', () => {
  assert.equal(validateSubmission({ ...companySubmission, newsletter_consent: 'true' }).submission.newsletterConsent, true);
  assert.equal(validateSubmission(companySubmission).submission.newsletterConsent, false);
});

test('forwards newsletter signup through the same-origin server path and reports real delivery status', async () => {
  let request;
  const result = await handleNewsletter({ email: '  Reader@Example.com ', page: '/research.html' }, {
    env: { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', SITE_INTAKE_SHARED_SECRET: 'server-secret' },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(result.status, 201);
  assert.equal(request.options.body.get('form'), 'newsletter');
  assert.equal(request.options.body.get('email'), 'reader@example.com');
  assert.equal(request.options.body.get('shared_secret'), 'server-secret');
  assert.equal((await handleNewsletter({ email: 'bad' }, {})).status, 400);
});

test('does not call Apps Script when the submission or server configuration is invalid', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('must not call Apps Script'); };
  const env = { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', SITE_INTAKE_SHARED_SECRET: 'server-secret' };
  const badSubmission = await handleSubmission({ ...companySubmission, email: 'bad' }, { env, fetchImpl });
  const missingConfig = await handleSubmission(companySubmission, { env: {}, fetchImpl });
  assert.equal(badSubmission.status, 400);
  assert.equal(missingConfig.status, 503);
  assert.equal(calls, 0);
});

test('forwards validated submissions with a private gate secret and returns the Apps Script result', async () => {
  let request;
  const result = await handleSubmission(expertSubmission, {
    env: { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', SITE_INTAKE_SHARED_SECRET: 'server-secret' },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true, emailStatus: 'awaiting_approval' }) };
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(request.url, 'https://script.google.com/macros/s/test/exec');
  assert.equal(request.options.body.get('shared_secret'), 'server-secret');
  assert.equal(request.options.body.get('form'), 'expert_application');
  assert.equal(request.options.body.get('email'), 'taylor@example.com');
  assert.equal(JSON.stringify(result.body).includes('server-secret'), false);
});

test('does not report success when Apps Script fails to record the inquiry', async () => {
  const result = await handleSubmission(companySubmission, {
    env: { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', SITE_INTAKE_SHARED_SECRET: 'server-secret' },
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: false, code: 'hubspot_error' }) }),
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
});

