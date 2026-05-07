import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SLACK_WEBHOOK_EXPERTS = Deno.env.get("SLACK_WEBHOOK_EXPERTS")!;
const WEBHOOK_SHARED_SECRET = Deno.env.get("WEBHOOK_SHARED_SECRET")!;

const fmt = (v: unknown) =>
  v === null || v === undefined || v === "" ? "(not provided)" : String(v);

const fmtList = (a: unknown) =>
  Array.isArray(a) && a.length ? a.map(String).join(", ") : "(not provided)";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SHARED_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const r = payload.record;

  const text = [
    ":bell: New expert network application",
    "",
    `Full name: ${fmt(r.name)}`,
    `Email: ${fmt(r.email)}`,
    `Title: ${fmt(r.title)}`,
    `Organization: ${fmt(r.organization)}`,
    `LinkedIn: ${fmt(r.linkedin)}`,
    `Location / time zone: ${fmt(r.timezone)}`,
    `Primary domain: ${fmt(r.domain)}`,
    `Years of experience: ${fmt(r.years_experience)}`,
    `Engagement preferences: ${fmtList(r.format)}`,
    `Background: ${fmt(r.background)}`,
    `Source: ${fmt(r.source)}`,
    "",
    `Submitted at: ${fmt(r.created_at)}`,
  ].join("\n");

  const slackRes = await fetch(SLACK_WEBHOOK_EXPERTS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!slackRes.ok) {
    const body = await slackRes.text();
    console.error("Slack POST failed", slackRes.status, body);
  }

  return new Response(JSON.stringify({ ok: slackRes.ok }), {
    headers: { "content-type": "application/json" },
  });
});
