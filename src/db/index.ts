import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const hostLocal = /(?:^|@)(localhost|127\.0\.0\.1|::1)(?::|\/)/i.test(databaseUrl);
const urlExigeSsl = /sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl);
const sslDefinidoPorEnv = process.env.DATABASE_SSL === "true" || process.env.DATABASE_SSL === "false";

/**
 * Bancos gerenciados (Supabase, Neon, Railway) exigem SSL. Ligamos o SSL
 * automaticamente quando a URL não aponta para um banco local, e também
 * aceitamos DATABASE_SSL=true/false para forçar o comportamento.
 */
function resolverSsl(): PoolConfig["ssl"] {
  if (sslDefinidoPorEnv) {
    return process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
  }
  if (urlExigeSsl) return { rejectUnauthorized: false };
  return hostLocal ? undefined : { rejectUnauthorized: false };
}

const configuracaoPool: PoolConfig = {
  connectionString: databaseUrl,
  ssl: resolverSsl(),
  // Limites conservadores: atendem o modo serverless e o pooler do Supabase.
  max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
};

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool(configuracaoPool);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

/** Descrição do alvo conectado (sem expor credenciais), usada no /api/health. */
export function descricaoBanco(): { host: string; porta: string; ssl: boolean } {
  try {
    const url = new URL(databaseUrl as string);
    return {
      host: url.hostname,
      porta: url.port || "5432",
      ssl: Boolean(resolverSsl()),
    };
  } catch {
    return { host: "desconhecido", porta: "5432", ssl: Boolean(resolverSsl()) };
  }
}
