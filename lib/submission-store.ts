import { dbSql as sql } from "@/lib/db-client";
import { getAdminSql } from "@/lib/db-admin-client";

export type InvoiceStatus = "pending" | "approved" | "declined" | "paid";

export type VideoSubmissionItem = {
  id: string;
  url: string;
  platform: string;
  campaignTag: string;
  amount: number;
  verified: boolean;
  approved: boolean;
};

export type CreatorSubmission = {
  id: string;
  createdAt: string;
  country: string;
  fullName: string;
  creatorEmail: string;
  companyName: string;
  recipientType: string;
  bankName: string;
  bankCountry: string;
  routingNumber: string;
  swiftCode: string;
  accountNumber: string;
  accountType: string;
  legalCountry: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceStatus: InvoiceStatus;
  approvedAt?: string;
  declinedAt?: string;
  paidAt?: string;
  videos: VideoSubmissionItem[];
  invoiceTotal: number;
};

type SubmissionRow = {
  id: string;
  created_at: Date | string;
  country: string;
  full_name: string;
  creator_email: string;
  company_name: string;
  recipient_type: string;
  bank_name: string;
  bank_country: string;
  routing_number: string;
  swift_code: string;
  account_number: string;
  account_type: string;
  legal_country: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  invoice_number: string;
  invoice_date: string;
  invoice_status: InvoiceStatus;
  approved_at: Date | string | null;
  declined_at: Date | string | null;
  paid_at: Date | string | null;
  invoice_total: string | number;
  videos_json: unknown;
};

type MemorySubmissionStore = {
  submissions: CreatorSubmission[];
};

const globalDb = globalThis as typeof globalThis & {
  __fureverDbReadyPromise?: Promise<void>;
  __fureverMemorySubmissionStore?: MemorySubmissionStore;
};

function hasPostgresConfig(): boolean {
  return Boolean(
    process.env.storage_POSTGRES_URL ||
      process.env.storage_DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL,
  );
}

function isScopedRoleMode(): boolean {
  return Boolean(process.env.DB_ROLE_USER && process.env.DB_ROLE_PASSWORD);
}

function getMemoryStore(): MemorySubmissionStore {
  if (!globalDb.__fureverMemorySubmissionStore) {
    globalDb.__fureverMemorySubmissionStore = { submissions: [] };
  }
  return globalDb.__fureverMemorySubmissionStore;
}

async function ensureSubmissionTable(): Promise<void> {
  if (!hasPostgresConfig()) {
    return;
  }

  const ddlSql = isScopedRoleMode() ? getAdminSql() : sql;
  if (!ddlSql) {
    return;
  }

  if (!globalDb.__fureverDbReadyPromise) {
    globalDb.__fureverDbReadyPromise = (async () => {
      await ddlSql`
        CREATE TABLE IF NOT EXISTS creator_submissions (
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
          invoice_number TEXT NOT NULL DEFAULT '',
          invoice_date TEXT NOT NULL DEFAULT '',
          invoice_status TEXT NOT NULL,
          approved_at TIMESTAMPTZ NULL,
          declined_at TIMESTAMPTZ NULL,
          paid_at TIMESTAMPTZ NULL,
          invoice_total NUMERIC(12, 2) NOT NULL,
          videos_json JSONB NOT NULL
        )
      `;
      await ddlSql`
        ALTER TABLE creator_submissions
        ADD COLUMN IF NOT EXISTS bank_country TEXT NOT NULL DEFAULT ''
      `;
      await ddlSql`
        ALTER TABLE creator_submissions
        ADD COLUMN IF NOT EXISTS invoice_number TEXT NOT NULL DEFAULT ''
      `;
      await ddlSql`
        ALTER TABLE creator_submissions
        ADD COLUMN IF NOT EXISTS invoice_date TEXT NOT NULL DEFAULT ''
      `;
      await ddlSql`
        ALTER TABLE creator_submissions
        ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ NULL
      `;
      await ddlSql`
        CREATE INDEX IF NOT EXISTS creator_submissions_created_at_idx
        ON creator_submissions (created_at DESC)
      `;
      try {
        await ddlSql`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE creator_submissions TO creator_portal_app`;
      } catch {
        // Role may not exist yet; keep running without hard failure.
      }
      try {
        await ddlSql`GRANT SELECT ON TABLE creator_submissions TO growth_ops_app`;
      } catch {
        // Role may not exist yet; keep running without hard failure.
      }
    })();
  }
  await globalDb.__fureverDbReadyPromise;
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseVideos(videosJson: unknown): VideoSubmissionItem[] {
  if (!Array.isArray(videosJson)) {
    return [];
  }
  return videosJson as VideoSubmissionItem[];
}

function mapRowToSubmission(row: SubmissionRow): CreatorSubmission {
  return {
    id: row.id,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    country: row.country,
    fullName: row.full_name,
    creatorEmail: row.creator_email,
    companyName: row.company_name,
    recipientType: row.recipient_type,
    bankName: row.bank_name,
    bankCountry: row.bank_country,
    routingNumber: row.routing_number,
    swiftCode: row.swift_code,
    accountNumber: row.account_number,
    accountType: row.account_type,
    legalCountry: row.legal_country,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    invoiceStatus: row.invoice_status,
    approvedAt: toIso(row.approved_at),
    declinedAt: toIso(row.declined_at),
    paidAt: toIso(row.paid_at),
    invoiceTotal: Number(row.invoice_total),
    videos: parseVideos(row.videos_json),
  };
}

export async function getAllSubmissions(): Promise<CreatorSubmission[]> {
  if (!hasPostgresConfig()) {
    return [...getMemoryStore().submissions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  await ensureSubmissionTable();
  const result = await sql<SubmissionRow>`
    SELECT
      id,
      created_at,
      country,
      full_name,
      creator_email,
      company_name,
      recipient_type,
      bank_name,
      bank_country,
      routing_number,
      swift_code,
      account_number,
      account_type,
      legal_country,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      invoice_number,
      invoice_date,
      invoice_status,
      approved_at,
      declined_at,
      paid_at,
      invoice_total,
      videos_json
    FROM creator_submissions
    ORDER BY created_at DESC
  `;
  return result.rows.map(mapRowToSubmission);
}

export async function addSubmission(submission: CreatorSubmission): Promise<void> {
  if (!hasPostgresConfig()) {
    getMemoryStore().submissions.push(submission);
    return;
  }
  await ensureSubmissionTable();
  await sql`
    INSERT INTO creator_submissions (
      id,
      created_at,
      country,
      full_name,
      creator_email,
      company_name,
      recipient_type,
      bank_name,
      bank_country,
      routing_number,
      swift_code,
      account_number,
      account_type,
      legal_country,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      invoice_number,
      invoice_date,
      invoice_status,
      approved_at,
      declined_at,
      paid_at,
      invoice_total,
      videos_json
    )
    VALUES (
      ${submission.id},
      ${submission.createdAt},
      ${submission.country},
      ${submission.fullName},
      ${submission.creatorEmail},
      ${submission.companyName},
      ${submission.recipientType},
      ${submission.bankName},
      ${submission.bankCountry},
      ${submission.routingNumber},
      ${submission.swiftCode},
      ${submission.accountNumber},
      ${submission.accountType},
      ${submission.legalCountry},
      ${submission.addressLine1},
      ${submission.addressLine2},
      ${submission.city},
      ${submission.state},
      ${submission.postalCode},
      ${submission.invoiceNumber},
      ${submission.invoiceDate},
      ${submission.invoiceStatus},
      ${submission.approvedAt ?? null},
      ${submission.declinedAt ?? null},
      ${submission.paidAt ?? null},
      ${submission.invoiceTotal},
      ${JSON.stringify(submission.videos)}
    )
  `;
}

export async function updateSubmissionStatus(
  id: string,
  nextStatus: InvoiceStatus,
): Promise<CreatorSubmission | null> {
  if (!hasPostgresConfig()) {
    const target = getMemoryStore().submissions.find((item) => item.id === id);
    if (!target) {
      return null;
    }
    target.invoiceStatus = nextStatus;
    if (nextStatus === "approved") {
      target.approvedAt = new Date().toISOString();
      target.declinedAt = undefined;
      target.paidAt = undefined;
      target.videos = target.videos.map((video) => ({ ...video, approved: true }));
    }
    if (nextStatus === "declined") {
      target.approvedAt = undefined;
      target.declinedAt = new Date().toISOString();
      target.paidAt = undefined;
      target.videos = target.videos.map((video) => ({ ...video, approved: false }));
    }
    if (nextStatus === "paid") {
      if (!target.approvedAt) {
        target.approvedAt = new Date().toISOString();
      }
      target.declinedAt = undefined;
      target.paidAt = new Date().toISOString();
      target.videos = target.videos.map((video) => ({ ...video, approved: true }));
    }
    if (nextStatus === "pending") {
      target.approvedAt = undefined;
      target.declinedAt = undefined;
      target.paidAt = undefined;
      target.videos = target.videos.map((video) => ({ ...video, approved: false }));
    }
    return target;
  }
  await ensureSubmissionTable();
  const existingResult = await sql<SubmissionRow>`
    SELECT
      id,
      created_at,
      country,
      full_name,
      creator_email,
      company_name,
      recipient_type,
      bank_name,
      bank_country,
      routing_number,
      swift_code,
      account_number,
      account_type,
      legal_country,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      invoice_number,
      invoice_date,
      invoice_status,
      approved_at,
      declined_at,
      paid_at,
      invoice_total,
      videos_json
    FROM creator_submissions
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existingResult.rowCount === 0) {
    return null;
  }

  const existing = mapRowToSubmission(existingResult.rows[0]);
  existing.invoiceStatus = nextStatus;
  if (nextStatus === "approved") {
    existing.approvedAt = new Date().toISOString();
    existing.declinedAt = undefined;
    existing.paidAt = undefined;
    existing.videos = existing.videos.map((video) => ({ ...video, approved: true }));
  }
  if (nextStatus === "declined") {
    existing.approvedAt = undefined;
    existing.declinedAt = new Date().toISOString();
    existing.paidAt = undefined;
    existing.videos = existing.videos.map((video) => ({ ...video, approved: false }));
  }
  if (nextStatus === "paid") {
    if (!existing.approvedAt) {
      existing.approvedAt = new Date().toISOString();
    }
    existing.declinedAt = undefined;
    existing.videos = existing.videos.map((video) => ({ ...video, approved: true }));
    existing.paidAt = new Date().toISOString();
  }
  if (nextStatus === "pending") {
    existing.approvedAt = undefined;
    existing.declinedAt = undefined;
    existing.paidAt = undefined;
    existing.videos = existing.videos.map((video) => ({ ...video, approved: false }));
  }

  await sql`
    UPDATE creator_submissions
    SET
      invoice_status = ${existing.invoiceStatus},
      approved_at = ${existing.approvedAt ?? null},
      declined_at = ${existing.declinedAt ?? null},
      paid_at = ${existing.paidAt ?? null},
      videos_json = ${JSON.stringify(existing.videos)}
    WHERE id = ${id}
  `;

  return existing;
}
