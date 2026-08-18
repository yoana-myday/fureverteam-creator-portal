import { sql } from "@vercel/postgres";

const CREATOR_ROLE = "creator_portal_app";
const GROWTH_ROLE = "growth_ops_app";

const creatorPassword = process.env.CREATOR_PORTAL_APP_DB_PASSWORD;
const growthPassword = process.env.GROWTH_OPS_APP_DB_PASSWORD;

if (!creatorPassword || !growthPassword) {
  console.error("Missing required env vars:");
  console.error("- CREATOR_PORTAL_APP_DB_PASSWORD");
  console.error("- GROWTH_OPS_APP_DB_PASSWORD");
  process.exit(1);
}

const escapeLiteral = (value) => value.replace(/'/g, "''");

async function createOrRotateRole(roleName, password) {
  const safePassword = escapeLiteral(password);
  await sql.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
    CREATE ROLE ${roleName} LOGIN PASSWORD '${safePassword}';
  ELSE
    ALTER ROLE ${roleName} WITH LOGIN PASSWORD '${safePassword}';
  END IF;
END $$;`);
}

async function run() {
  await sql`CREATE TABLE IF NOT EXISTS creator_submissions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL,
    country TEXT NOT NULL,
    full_name TEXT NOT NULL,
    creator_email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    recipient_type TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_country TEXT NOT NULL,
    routing_number TEXT NOT NULL,
    swift_code TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL,
    legal_country TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    invoice_status TEXT NOT NULL,
    approved_at TIMESTAMPTZ NULL,
    paid_at TIMESTAMPTZ NULL,
    invoice_total NUMERIC(12, 2) NOT NULL,
    videos_json JSONB NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS invoice_daily_sequences (
    date_stamp TEXT PRIMARY KEY,
    counter INTEGER NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS growth_video_modules (
    module TEXT PRIMARY KEY,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    deleted_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await createOrRotateRole(CREATOR_ROLE, creatorPassword);
  await createOrRotateRole(GROWTH_ROLE, growthPassword);

  await sql.query(`REVOKE ALL ON TABLE creator_submissions FROM ${GROWTH_ROLE}`);
  await sql.query(`REVOKE ALL ON TABLE invoice_daily_sequences FROM ${GROWTH_ROLE}`);
  await sql.query(`REVOKE ALL ON TABLE growth_video_modules FROM ${CREATOR_ROLE}`);
  await sql.query(`REVOKE ALL ON TABLE growth_video_modules FROM ${GROWTH_ROLE}`);
  await sql.query(`REVOKE ALL ON TABLE creator_submissions FROM ${CREATOR_ROLE}`);
  await sql.query(`REVOKE ALL ON TABLE invoice_daily_sequences FROM ${CREATOR_ROLE}`);

  await sql.query(`GRANT USAGE ON SCHEMA public TO ${CREATOR_ROLE}, ${GROWTH_ROLE}`);

  await sql.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE creator_submissions, invoice_daily_sequences TO ${CREATOR_ROLE}`,
  );
  await sql.query(`GRANT SELECT ON TABLE growth_video_modules TO ${CREATOR_ROLE}`);

  await sql.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE growth_video_modules TO ${GROWTH_ROLE}`);
  await sql.query(`GRANT SELECT ON TABLE creator_submissions, invoice_daily_sequences TO ${GROWTH_ROLE}`);

  console.log("Cross-site DB permissions configured.");
  console.log(`Creator portal role: ${CREATOR_ROLE}`);
  console.log(`Growth ops role: ${GROWTH_ROLE}`);
}

run().catch((error) => {
  console.error("Failed to configure DB permissions:", error);
  process.exit(1);
});
