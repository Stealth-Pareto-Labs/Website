-- Form-fill applications from experts.html.
-- Distinct from public.expert_portal_profiles (which is for accepted experts with auth.users accounts).
-- Reviewers manually onboard approved applicants from this table later.

CREATE TABLE IF NOT EXISTS public.expert_applications (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    name             text NOT NULL,
    email            text NOT NULL,
    title            text,
    organization     text,
    linkedin         text,
    timezone         text,
    domain           text,
    years_experience text,
    format           text[],
    background       text,
    source           text
);

ALTER TABLE public.expert_applications ENABLE ROW LEVEL SECURITY;

-- Form-fillers are unauthenticated; allow anon role to insert only.
-- No SELECT/UPDATE/DELETE policy — anon cannot read or modify rows.
CREATE POLICY "anon insert expert_applications"
  ON public.expert_applications
  FOR INSERT TO anon
  WITH CHECK (true);
