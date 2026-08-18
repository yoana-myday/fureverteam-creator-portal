import { dbSql as sql } from "@/lib/db-client";
import { getAdminSql } from "@/lib/db-admin-client";

const globalInvoiceDb = globalThis as typeof globalThis & {
  __fureverInvoiceDbReadyPromise?: Promise<void>;
  __fureverInvoiceMemoryStore?: {
    lastDate: string;
    counter: number;
  };
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

function getMemoryStore() {
  if (!globalInvoiceDb.__fureverInvoiceMemoryStore) {
    globalInvoiceDb.__fureverInvoiceMemoryStore = {
      lastDate: "",
      counter: 0,
    };
  }
  return globalInvoiceDb.__fureverInvoiceMemoryStore;
}

function formatDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatDateText(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ensureInvoiceSequenceTable(): Promise<void> {
  if (!hasPostgresConfig()) {
    return;
  }
  const ddlSql = isScopedRoleMode() ? getAdminSql() : sql;
  if (!ddlSql) {
    return;
  }
  if (!globalInvoiceDb.__fureverInvoiceDbReadyPromise) {
    globalInvoiceDb.__fureverInvoiceDbReadyPromise = (async () => {
      await ddlSql`
        CREATE TABLE IF NOT EXISTS invoice_daily_sequences (
          date_stamp TEXT PRIMARY KEY,
          counter INTEGER NOT NULL
        )
      `;
      try {
        await ddlSql`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE invoice_daily_sequences TO creator_portal_app`;
      } catch {
        // Role may not exist yet; keep running without hard failure.
      }
      try {
        await ddlSql`GRANT SELECT ON TABLE invoice_daily_sequences TO growth_ops_app`;
      } catch {
        // Role may not exist yet; keep running without hard failure.
      }
    })();
  }
  await globalInvoiceDb.__fureverInvoiceDbReadyPromise;
}

export async function nextInvoiceNumber(
  now = new Date(),
): Promise<{ invoiceNumber: string; dateText: string }> {
  if (!hasPostgresConfig()) {
    const memory = getMemoryStore();
    const dateStamp = formatDateStamp(now);
    if (memory.lastDate !== dateStamp) {
      memory.lastDate = dateStamp;
      memory.counter = 0;
    }
    memory.counter += 1;
    return {
      invoiceNumber: `INV-${dateStamp}-${String(memory.counter).padStart(2, "0")}`,
      dateText: formatDateText(now),
    };
  }

  await ensureInvoiceSequenceTable();

  const dateStamp = formatDateStamp(now);
  const result = await sql<{ counter: number | string }>`
    INSERT INTO invoice_daily_sequences (date_stamp, counter)
    VALUES (${dateStamp}, 1)
    ON CONFLICT (date_stamp)
    DO UPDATE SET counter = invoice_daily_sequences.counter + 1
    RETURNING counter
  `;
  const nextCounter = Number(result.rows[0]?.counter ?? 1);
  const serial = String(nextCounter).padStart(2, "0");

  return {
    invoiceNumber: `INV-${dateStamp}-${serial}`,
    dateText: formatDateText(now),
  };
}
