/**
 * Gera o arquivo físico `sql/schema-arquivo-morto-supabase.sql` a partir da
 * constante SCRIPT_SCHEMA_SQL (fonte única da verdade).
 *
 * Uso: node scripts/exportar-sql.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const fonteTs = path.join(process.cwd(), "src/lib/sql/schema.ts");
const destino = path.join(process.cwd(), "sql/schema-arquivo-morto-supabase.sql");

const conteudoTs = await readFile(fonteTs, "utf8");
const captura = /export const SCRIPT_SCHEMA_SQL = `([\s\S]*?)`;/.exec(conteudoTs);

if (!captura) {
  console.error("Não foi possível localizar SCRIPT_SCHEMA_SQL em src/lib/sql/schema.ts");
  process.exit(1);
}

const cabecalho = `-- Arquivo gerado automaticamente por scripts/exportar-sql.mjs
-- Fonte: src/lib/sql/schema.ts (não edite este arquivo à mão)
-- Alvo: PostgreSQL 13+ / Supabase (todas as versões atuais)

`;

await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, cabecalho + captura[1], "utf8");

const linhas = (cabecalho + captura[1]).split("\n").length;
console.log(`Gerado ${path.relative(process.cwd(), destino)} (${linhas} linhas).`);
