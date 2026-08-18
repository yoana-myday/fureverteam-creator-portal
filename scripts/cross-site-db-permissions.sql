-- Run this in Neon SQL Editor using the owner account.
-- Replace the two passwords before running.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'creator_portal_app') THEN
    CREATE ROLE creator_portal_app LOGIN PASSWORD 'REPLACE_CREATOR_PASSWORD';
  ELSE
    ALTER ROLE creator_portal_app WITH LOGIN PASSWORD 'REPLACE_CREATOR_PASSWORD';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growth_ops_app') THEN
    CREATE ROLE growth_ops_app LOGIN PASSWORD 'REPLACE_GROWTH_PASSWORD';
  ELSE
    ALTER ROLE growth_ops_app WITH LOGIN PASSWORD 'REPLACE_GROWTH_PASSWORD';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.growth_video_modules (
  module TEXT PRIMARY KEY,
  rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO creator_portal_app, growth_ops_app;

REVOKE ALL ON TABLE public.creator_submissions FROM creator_portal_app, growth_ops_app;
REVOKE ALL ON TABLE public.invoice_daily_sequences FROM creator_portal_app, growth_ops_app;
REVOKE ALL ON TABLE public.growth_video_modules FROM creator_portal_app, growth_ops_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.creator_submissions TO creator_portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_daily_sequences TO creator_portal_app;
GRANT SELECT ON TABLE public.growth_video_modules TO creator_portal_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.growth_video_modules TO growth_ops_app;
GRANT SELECT ON TABLE public.creator_submissions TO growth_ops_app;
GRANT SELECT ON TABLE public.invoice_daily_sequences TO growth_ops_app;
