/**
 * Cria (de forma idempotente) todas as tabelas e índices do sistema no
 * PostgreSQL de destino — Supabase, Neon, Railway ou servidor local.
 *
 * Uso:
 *   DATABASE_URL="postgresql://...supabase.co:5432/postgres" node scripts/setup-supabase.mjs
 *
 * Não apaga nada: se as tabelas já existirem, apenas confere a estrutura.
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Defina DATABASE_URL antes de executar este script.");
  process.exit(1);
}

const TAMANHO_MAX_CARACTERES_CONEXAO = 255;

const DDL = [
  `create table if not exists prontuarios (
     id serial primary key,
     rm varchar(30) not null,
     nome varchar(120) not null,
     sobrenome varchar(160) not null,
     nome_busca varchar(160) not null,
     sobrenome_busca varchar(200) not null,
     observacoes text,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     constraint prontuarios_rm_unique unique (rm)
   )`,
  `create index if not exists prontuarios_nome_busca_idx on prontuarios (nome_busca)`,
  `create index if not exists prontuarios_sobrenome_busca_idx on prontuarios (sobrenome_busca)`,

  `create table if not exists importacoes (
     id serial primary key,
     arquivo varchar(255) not null,
     modo varchar(20) not null default 'importacao',
     total_linhas integer not null default 0,
     inseridos integer not null default 0,
     atualizados integer not null default 0,
     ignorados integer not null default 0,
     erros jsonb not null default '[]'::jsonb,
     created_at timestamptz not null default now()
   )`,

  `create table if not exists backup_arquivos (
     id serial primary key,
     nome varchar(255) not null,
     conteudo text not null,
     tamanho_bytes integer not null default 0,
     total_registros integer not null default 0,
     created_at timestamptz not null default now()
   )`,
];

function normalizarUrl(url) {
  // Evita o aviso do pg sobre sslmode na URL: tratamos o SSL no cliente.
  return url.replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, inicio, fim) => (fim ? inicio : ""));
}

const hostLocal = /(?:^|@)(localhost|127\.0\.0\.1|::1)(?::|\/)/i.test(connectionString);
const usarSsl = process.env.DATABASE_SSL === "true" || !hostLocal;

const client = new pg.Client({
  connectionString: normalizarUrl(connectionString),
  ssl: usarSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const alvo = await client.query(
    "select current_database() as banco, current_user as usuario, version() as versao",
  );
  console.log(`Conectado em ${alvo.rows[0].banco} como ${alvo.rows[0].usuario}`);
  console.log(`PostgreSQL: ${String(alvo.rows[0].versao).split(",")[0]}`);
  console.log(`SSL: ${usarSsl ? "ativo" : "desativado"}`);
  console.log("");

  for (const comando of DDL) {
    const nomeTabela = /table if not exists (\w+)/i.exec(comando)?.[1] ?? "índice";
    await client.query(comando);
    console.log(`  ✓ ${nomeTabela}`);
  }

  // Ajuste defensivo de tamanho de coluna para conexões com limites menores.
  await client.query(
    `alter table importacoes alter column arquivo type varchar(${TAMANHO_MAX_CARACTERES_CONEXAO})`,
  );

  const { rows } = await client.query(
    `select 'prontuarios' as tabela, count(*)::int as registros from prontuarios
     union all select 'importacoes', count(*)::int from importacoes
     union all select 'backup_arquivos', count(*)::int from backup_arquivos
     order by tabela`,
  );

  console.log("\nEstrutura pronta. Registros atuais:");
  rows.forEach((linha) => console.log(`  ${linha.tabela.padEnd(18, " ")} ${linha.registros}`));

  console.log(
    "\nPróximos passos:\n" +
      "  1) Aponte DATABASE_URL da aplicação para este banco (use a porta 6543 do pooler em produção).\n" +
      "  2) Publique a aplicação com as variáveis DATABASE_URL e DATABASE_POOL_MAX.\n" +
      "  3) Importe a planilha de prontuários pela tela “Importar planilha”.",
  );
} catch (erro) {
  console.error("\nFalha ao preparar o banco:");
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
