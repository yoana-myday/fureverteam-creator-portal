import { createPool } from "@vercel/postgres";

type AdminSql = ReturnType<typeof createPool>["sql"] | null;
const HARDCODED_FALLBACK_CONNECTION =
  "postgresql://neondb_owner:npg_hrfHCbqZB8t3@ep-dry-tree-aqxv1bqs-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

const globalAdminClient = globalThis as typeof globalThis & {
  __fureverAdminSql?: AdminSql;
};

function getAdminConnectionString(): string | null {
  return (
    process.env.storage_POSTGRES_URL ||
    process.env.storage_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    HARDCODED_FALLBACK_CONNECTION ||
    null
  );
}

export function getAdminSql(): AdminSql {
  if (globalAdminClient.__fureverAdminSql !== undefined) {
    return globalAdminClient.__fureverAdminSql;
  }

  const connectionString = getAdminConnectionString();
  if (!connectionString) {
    globalAdminClient.__fureverAdminSql = null;
    return null;
  }

  const pool = createPool({ connectionString });
  globalAdminClient.__fureverAdminSql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    pool.sql(strings, ...(values as Parameters<typeof pool.sql> extends [
      TemplateStringsArray,
      ...infer Rest,
    ]
      ? Rest
      : never))) as ReturnType<typeof createPool>["sql"];
  return globalAdminClient.__fureverAdminSql;
}
