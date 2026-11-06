import { handleSiteIntakeRequest } from '../../api/lib/site-intake.js';

export async function onRequest({ request, env }) {
  return handleSiteIntakeRequest(request, env);
}
