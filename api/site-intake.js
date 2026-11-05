import { handleNewsletter, handleSubmission } from './lib/site-intake.js';

export default async function siteIntake(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const result = req.body && req.body.formType === 'newsletter'
    ? await handleNewsletter(req.body)
    : await handleSubmission(req.body);
  return res.status(result.status).json(result.body);
}
