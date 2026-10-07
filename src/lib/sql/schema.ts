/**
 * Script SQL de criação do banco (PostgreSQL / Supabase).
 *
 * Fonte única da verdade: o arquivo `sql/schema-arquivo-morto-supabase.sql` é
 * gerado a partir desta constante com `node scripts/exportar-sql.mjs`.
 *
 * Regra: não use backticks (`` ` ``) nem `${` dentro do SQL, para que a extração
 * do texto continue funcionando.
 */
export const NOME_ARQUIVO_SQL = "schema-arquivo-morto-supabase.sql";

export const SCRIPT_SCHEMA_SQL = `-- =============================================================================
-- ARQUIVO MORTO ESCOLAR - EE PROFA. MARLENE FRATTINI - MATAO-SP
-- Script de criacao das tabelas (PostgreSQL / Supabase)
--
-- COMO USAR NO SUPABASE
--   1. Abra o projeto em https://supabase.com
--   2. Menu lateral: SQL Editor -> New query
--   3. Cole TODO este arquivo e clique em RUN
--   4. Confira o resultado final: deve mostrar as 3 tabelas com contagem 0
--
-- O script e idempotente: pode ser executado quantas vezes for necessario,
-- sem apagar dados ja existentes.
--
-- Este sistema usa apenas PostgreSQL padrao: nao exige nenhuma extensao
-- (nada de unaccent, uuid-ossp, pgcrypto). Funciona em Supabase 15, 16 e 17.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) PRONTUARIOS: registro de cada aluno do arquivo morto
--    As colunas nome_busca e sobrenome_busca guardam o texto normalizado
--    (sem acento e em minusculas) e sustentam a busca por inicio de palavra.
-- -----------------------------------------------------------------------------
create table if not exists prontuarios (
  id               serial primary key,
  rm               varchar(30)  not null,
  nome             varchar(120) not null,
  sobrenome        varchar(160) not null,
  nome_busca       varchar(160) not null,
  sobrenome_busca  varchar(200) not null,
  observacoes      text,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  constraint prontuarios_rm_unique unique (rm)
);

comment on table  prontuarios is 'Prontuarios arquivados (arquivo morto da escola).';
comment on column prontuarios.rm is 'Registro do aluno (identificador unico).';
comment on column prontuarios.nome is 'Primeiro nome do aluno, como cadastrado.';
comment on column prontuarios.sobrenome is 'Sobrenome(s) do aluno, como cadastrado.';
comment on column prontuarios.nome_busca is 'Nome normalizado (sem acento, minusculo) usado na busca por prefixo.';
comment on column prontuarios.sobrenome_busca is 'Sobrenome normalizado (sem acento, minusculo) usado na busca por prefixo.';
comment on column prontuarios.observacoes is 'Anotacoes internas da secretaria escolar.';

-- Garante a unicidade do RM caso a tabela tenha sido criada antes sem a constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prontuarios_rm_unique'
  ) then
    alter table prontuarios add constraint prontuarios_rm_unique unique (rm);
  end if;
end $$;

create index if not exists prontuarios_nome_busca_idx      on prontuarios (nome_busca);
create index if not exists prontuarios_sobrenome_busca_idx on prontuarios (sobrenome_busca);

-- -----------------------------------------------------------------------------
-- 2) IMPORTACOES: auditoria de importacoes de planilha, restauracoes e backups
-- -----------------------------------------------------------------------------
create table if not exists importacoes (
  id            serial primary key,
  arquivo       varchar(255) not null,
  modo          varchar(20)  not null default 'importacao',
  total_linhas  integer      not null default 0,
  inseridos     integer      not null default 0,
  atualizados   integer      not null default 0,
  ignorados     integer      not null default 0,
  erros         jsonb        not null default '[]'::jsonb,
  created_at    timestamptz  not null default now()
);

comment on table  importacoes is 'Historico de importacoes de planilha, restauracoes e backups.';
comment on column importacoes.modo is 'Valores: importacao, restauracao-mesclar, restauracao-total, backup.';
comment on column importacoes.erros is 'Lista de linhas ignoradas: [{ "linha": 12, "mensagem": "..." }].';

create index if not exists importacoes_created_at_idx on importacoes (created_at desc);

-- -----------------------------------------------------------------------------
-- 3) BACKUP_ARQUIVOS: copias de seguranca guardadas dentro do proprio sistema
--    (usadas quando o download do arquivo .json e bloqueado pela rede)
-- -----------------------------------------------------------------------------
create table if not exists backup_arquivos (
  id               serial primary key,
  nome             varchar(255) not null,
  conteudo         text         not null,
  tamanho_bytes    integer      not null default 0,
  total_registros  integer      not null default 0,
  created_at       timestamptz  not null default now()
);

comment on table backup_arquivos is 'Copias de seguranca do acervo guardadas no sistema (maximo de 10).';

create index if not exists backup_arquivos_created_at_idx on backup_arquivos (created_at desc);

-- Ajuste defensivo de tamanho de coluna (seguro repetir).
alter table importacoes   alter column arquivo type varchar(255);
alter table backup_arquivos alter column nome  type varchar(255);

commit;

-- -----------------------------------------------------------------------------
-- CONFERENCIA: deve listar as 3 tabelas (com 0 registros em um banco novo)
-- -----------------------------------------------------------------------------
select 'prontuarios'      as tabela, count(*)::int as registros from prontuarios
union all
select 'importacoes'      as tabela, count(*)::int as registros from importacoes
union all
select 'backup_arquivos'  as tabela, count(*)::int as registros from backup_arquivos
order by tabela;

-- FIM DO SCRIPT
`;
