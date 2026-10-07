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
  application_name: "arquivo-morto-escolar",
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

// ---------------------------------------------------------------------------
// Resiliência: quedas momentâneas de conexão (banco reiniciando, pooler do
// Supabase reciclando conexões, rede oscilando) NÃO devem derrubar o sistema.
// ---------------------------------------------------------------------------

const CODIGOS_TRANSITORIOS = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
]);

const MENSAGENS_TRANSITORIAS =
  /connection terminated|connection ended|server closed the connection|timeout exceeded when trying to connect|terminating connection|too many clients|socket hang up|client network socket disconnected/i;

/** Identifica falhas que valem uma nova tentativa (não erros de SQL/dados). */
export function erroTransitorio(erro: unknown): boolean {
  const codigo = (erro as { code?: string } | null)?.code;
  if (typeof codigo === "string" && CODIGOS_TRANSITORIOS.has(codigo)) return true;
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  return MENSAGENS_TRANSITORIAS.test(mensagem);
}

const pausa = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

async function comRetentativa<T>(operacao: () => Promise<T>, tentativas = 3): Promise<T> {
  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;
      if (!erroTransitorio(erro) || tentativa === tentativas) throw erro;

      await pausa(150 * tentativa);
      console.warn(
        `[db] falha transitória (tentativa ${tentativa}/${tentativas}): ${
          erro instanceof Error ? erro.message : String(erro)
        }`,
      );
    }
  }

  throw ultimoErro;
}

const queryOriginal = pool.query.bind(pool);
pool.query = (async (...args: unknown[]) => {
  const executar = () =>
    (queryOriginal as unknown as (...parametros: unknown[]) => Promise<unknown>)(...args);
  return comRetentativa(executar);
}) as typeof pool.query;

const conectarOriginal = pool.connect.bind(pool);
pool.connect = ((...args: unknown[]) => {
  const conectar = () =>
    (conectarOriginal as unknown as (...parametros: unknown[]) => Promise<unknown>)(...args);
  return comRetentativa(conectar);
}) as typeof pool.connect;

// Sem este tratador, um erro em conexão ociosa encerra o processo Node.
pool.on("error", (erro) => {
  console.error("[db] erro em conexão ociosa (o pool vai se recuperar):", erro.message);
});

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
