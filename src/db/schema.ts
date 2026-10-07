import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Prontuários arquivados (arquivo morto da escola).
 *
 * `nomeBusca` / `sobrenomeBusca` guardam versões normalizadas (sem acento,
 * minúsculas) para permitir busca por prefixo de palavra sem depender da
 * extensão `unaccent` do PostgreSQL.
 */
export const prontuarios = pgTable(
  "prontuarios",
  {
    id: serial("id").primaryKey(),
    rm: varchar("rm", { length: 30 }).notNull().unique(),
    nome: varchar("nome", { length: 120 }).notNull(),
    sobrenome: varchar("sobrenome", { length: 160 }).notNull(),
    nomeBusca: varchar("nome_busca", { length: 160 }).notNull(),
    sobrenomeBusca: varchar("sobrenome_busca", { length: 200 }).notNull(),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("prontuarios_sobrenome_busca_idx").on(table.sobrenomeBusca),
    index("prontuarios_nome_busca_idx").on(table.nomeBusca),
  ],
);

export type Prontuario = typeof prontuarios.$inferSelect;
export type NovoProntuario = typeof prontuarios.$inferInsert;

/** Histórico de importações de planilhas, para rastreabilidade. */
export const importacoes = pgTable("importacoes", {
  id: serial("id").primaryKey(),
  arquivo: varchar("arquivo", { length: 255 }).notNull(),
  modo: varchar("modo", { length: 20 }).notNull().default("importacao"),
  totalLinhas: integer("total_linhas").notNull().default(0),
  inseridos: integer("inseridos").notNull().default(0),
  atualizados: integer("atualizados").notNull().default(0),
  ignorados: integer("ignorados").notNull().default(0),
  erros: jsonb("erros")
    .$type<{ linha: number; mensagem: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Importacao = typeof importacoes.$inferSelect;

/**
 * Cópias de segurança guardadas dentro do próprio sistema, para uso quando o
 * download do arquivo .json é bloqueado pelo navegador/rede da escola.
 */
export const backupArquivos = pgTable("backup_arquivos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  conteudo: text("conteudo").notNull(),
  tamanhoBytes: integer("tamanho_bytes").notNull().default(0),
  totalRegistros: integer("total_registros").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type BackupArquivo = typeof backupArquivos.$inferSelect;
