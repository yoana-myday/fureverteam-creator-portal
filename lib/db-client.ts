import { createPool, sql as defaultSql } from "@vercel/postgres";

type SqlLike = typeof defaultSql;
const HARDCODED_FALLBACK_CONNECTION =
  "postgresql://neondb_owner:npg_hrfHCbqZB8t3@ep-dry-tree-aqxv1bqs-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

const globalDbClient = globalThis as typeof globalThis & {
  __fureverScopedSql?: SqlLike;
};

function buildRoleConnectionString(): string | null {
  const roleUser = process.env.DB_ROLE_USER;
  const rolePassword = process.env.DB_ROLE_PASSWORD;
  const host =
    process.env.storage_PGHOST ||
    process.env.storage_POSTGRES_HOST ||
    process.env.PGHOST ||
    process.env.POSTGRES_HOST;
  const database =
    process.env.storage_PGDATABASE ||
    process.env.storage_POSTGRES_DATABASE ||
    process.env.PGDATABASE ||
    process.env.POSTGRES_DATABASE;
  const port = process.env.storage_PGPORT || process.env.PGPORT || "5432";

  if (!roleUser || !rolePassword || !host || !database) {
    return null;
  }

  const encodedUser = encodeURIComponent(roleUser);
  const encodedPassword = encodeURIComponent(rolePassword);
  return `postgres://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?sslmode=require`;
}

function getDirectConnectionString(): string | null {
  return (
    process.env.storage_POSTGRES_URL ||
    process.env.storage_POSTGRES_URL_NON_POOLING ||
    process.env.storage_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    HARDCODED_FALLBACK_CONNECTION ||
    null
  );
}

function getScopedSql() {
  if (globalDbClient.__fureverScopedSql) {
    return globalDbClient.__fureverScopedSql;
  }

  const roleConnectionString = buildRoleConnectionString();
  const fallbackConnectionString = getDirectConnectionString();
  const selectedConnectionString = roleConnectionString || fallbackConnectionString;

  if (!selectedConnectionString) {
    globalDbClient.__fureverScopedSql = defaultSql;
    return defaultSql;
  }

  const pool = createPool({ connectionString: selectedConnectionString });
  const scopedSql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    pool.sql(strings, ...(values as Parameters<typeof pool.sql> extends [
      TemplateStringsArray,
      ...infer Rest,
    ]
      ? Rest
      : never))) as SqlLike;
  globalDbClient.__fureverScopedSql = scopedSql;
  return scopedSql;
}

export const dbSql = getScopedSql();
