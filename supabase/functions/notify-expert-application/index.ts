import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SLACK_WEBHOOK_EXPERTS = Deno.env.get("SLACK_WEBHOOK_EXPERTS")!;
const WEBHOOK_SHARED_SECRET = Deno.env.get("WEBHOOK_SHARED_SECRET")!;

const fmt = (v: unknown) =>
  v === null || v === undefined || v === "" ? "(not provided)" : String(v);

const fmtList = (a: unknown) =>
  Array.isArray(a) && a.length ? a.map(String).join(", ") : "(not provided)";

// Pretty-print form tokens
const ENGAGEMENT_LABELS: Record<string, string> = {
  ai_training_only: "AI training only",
  advisory_also: "AI training + paid advisory",
  both: "AI training, advisory, and consulting",
  not_sure: "Not sure yet",
};
const HOURS_LABELS: Record<string, string> = {
  "1_5": "1-5 hrs/week",
  "5_10": "5-10 hrs/week",
  "10_20": "10-20 hrs/week",
  "20_plus": "20+ hrs/week",
};
const pretty = (map: Record<string, string>, v: unknown) =>
  typeof v === "string" && map[v] ? map[v] : fmt(v);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SHARED_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const r = payload.record;
  const d = r.details ?? {};
  const hasDetails = r.details && Object.keys(r.details).length > 0;

  const lines = [
    ":bell: New expert network application",
    "",
    `Full name: ${fmt(r.name)}`,
    `Email: ${fmt(r.email)}`,
    `Title: ${fmt(r.title)}`,
    `Organization: ${fmt(r.organization)}`,
    `LinkedIn: ${fmt(r.linkedin)}`,
    `Primary domain: ${fmt(r.domain)}`,
    `Years of experience: ${fmt(r.years_experience)}`,
    `Background: ${fmt(r.background)}`,
  ];

  if (hasDetails) {
    lines.push(
      "",
      "*Profile details*",
      `Bio: ${fmt(d.bio)}`,
      `Employment status: ${fmt(d.employment_status)}`,
      `Expertise depth: ${fmt(d.expertise_depth)}`,
      `Top skills: ${fmtList(d.top_skills)}`,
      `Offering types: ${fmtList(d.offering_types)}`,
      `Hours/week: ${pretty(HOURS_LABELS, d.hours_per_week)}`,
      `Turnaround: ${fmt(d.turnaround)}`,
      `Engagement interest: ${pretty(ENGAGEMENT_LABELS, d.engagement_interest)}`,
    );

    if (d.engagement_interest === "advisory_also" || d.engagement_interest === "both") {
      lines.push(
        `Rate: ${fmt(d.rate_amount)} (${fmt(d.rate_type)})`,
        `Preferred formats: ${fmtList(d.preferred_formats)}`,
      );
    }

    lines.push(
      `Languages: ${fmtList(d.languages)}`,
      `Geo markets: ${fmtList(d.geo_markets)}`,
    );

    if (d.degree_level || d.degree_field || d.degree_school) {
      const edu = [d.degree_level, d.degree_field, d.degree_school]
        .filter(Boolean).join(" · ");
      lines.push(`Education: ${edu}`);
    }

    if (d.portfolio_title || d.portfolio_desc) {
      lines.push(`Portfolio: ${fmt(d.portfolio_title)} — ${fmt(d.portfolio_desc)}`);
    }
  }

  lines.push("", `Source: ${fmt(r.source)}`, `Submitted at: ${fmt(r.created_at)}`);

  const text = lines.join("\n");

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
