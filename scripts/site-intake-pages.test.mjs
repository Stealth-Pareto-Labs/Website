import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { onRequest } from '../functions/api/site-intake.js';

const jsonRequest = (payload, headers = {}) => new Request('https://website.test/api/site-intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: typeof payload === 'string' ? payload : JSON.stringify(payload),
});

test('Pages adapter rejects methods other than POST', async () => {
  const response = await onRequest({ request: new Request('https://website.test/api/site-intake'), env: {} });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Pages adapter requires JSON and reports malformed JSON', async () => {
  const notJson = await onRequest({ request: new Request('https://website.test/api/site-intake', { method: 'POST', body: 'x' }), env: {} });
  assert.equal(notJson.status, 415);

  const malformed = await onRequest({ request: jsonRequest('{'), env: {} });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).ok, false);
});

test('Pages adapter validates forms and uses Cloudflare environment bindings', async () => {
  const invalid = await onRequest({ request: jsonRequest({ formType: 'company', email: 'bad' }), env: {} });
  assert.equal(invalid.status, 400);

  const validButUnconfigured = await onRequest({
    request: jsonRequest({ formType: 'company', name: 'Jamie', email: 'jamie@example.com', company: 'Acme', role: 'Other', challenge: 'Improve work' }),
    env: {},
  });
  assert.equal(validButUnconfigured.status, 503);
  assert.equal((await validButUnconfigured.json()).ok, false);
});

test('Pages adapter routes newsletter requests through newsletter validation', async () => {
  const invalid = await onRequest({ request: jsonRequest({ formType: 'newsletter', email: 'bad' }), env: {} });
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /valid email/i);
});

test('company and expert confirmations acknowledge responses and invite visitors to follow Pareto', () => {
  for (const path of ['../index.html', '../experts.html']) {
    const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(/We(?:&rsquo;|’)ve received your responses\./i.test(html), `${path} should say responses were received`);
    assert.ok(/Please follow us online:/i.test(html), `${path} should introduce the social links`);
    for (const social of ['Discord', 'LinkedIn', '>X<', 'Instagram']) {
      assert.ok(html.includes(social), `${path} should include ${social}`);
    }
  }
});
