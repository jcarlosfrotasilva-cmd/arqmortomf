# Migrar o Arquivo Morto para o Supabase

Sim — **o sistema já está estruturado para o Supabase**. Não há nada de proprietário: todo o banco é
PostgreSQL padrão (sem extensões, sem `unaccent`, sem funções customizadas), então o mesmo código
roda local, no Supabase, no Neon ou em qualquer Postgres gerenciado. Trocar de banco é **apenas
alterar uma variável de ambiente**.

## 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com> → **New project** (região mais próxima: `South America (São Paulo)`).
2. Guarde a **senha do banco** definida na criação.
3. Em **Project Settings → Database**, copie as duas strings de conexão:
   - **Connection pooling** (porta `6543`) → é a que vai para produção/Vercel.
   - **Direct connection** (porta `5432`) → é a que usaremos para criar as tabelas.

## 2. Criar as tabelas (uma única vez)

### Opção A — pelo arquivo SQL (recomendado)

O arquivo está no repositório: **`sql/schema-arquivo-morto-supabase.sql`**.
Também dá para abrir/copiar pelo sistema: **Backup e restauração → “Script SQL do banco” → Ver script SQL**.

1. Supabase → **SQL Editor** → **New query**
2. Cole o conteúdo do arquivo e clique em **RUN**
3. No fim aparece a conferência com as 3 tabelas e a contagem de registros

O script é **idempotente** (pode rodar quantas vezes quiser, sem apagar nada) e não usa nenhuma
extensão do PostgreSQL — só recursos padrão (serial, timestamptz, jsonb, índices, constraint única).

### Opção B — por linha de comando

```bash
# executa exatamente o mesmo schema usando o Node
DATABASE_URL="postgresql://postgres:SENHA@db.SEUPROJETO.supabase.co:5432/postgres" \
  node scripts/setup-supabase.mjs

# ou direto pelo psql
psql "postgresql://postgres:SENHA@db.SEUPROJETO.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=1 -f sql/schema-arquivo-morto-supabase.sql
```

### Opção C — pelo Drizzle (schema TypeScript como fonte)

```bash
DATABASE_URL="postgresql://...:5432/postgres" \
  npx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts --url "$DATABASE_URL"
```

Tabelas criadas:

| Tabela | Conteúdo |
|---|---|
| `prontuarios` | RM (único), nome, sobrenome, versões normalizadas para busca, observações, datas |
| `importacoes` | auditoria de importações, restaurações e backups |
| `backup_arquivos` | cópias de segurança guardadas dentro do sistema (máx. 10, as antigas são podadas) |


## 3. Configurar a aplicação

No `.env` local:

```env
DATABASE_URL=postgresql://postgres.SEUPROJETO:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_POOL_MAX=5
```

Na **Vercel** (Settings → Environment Variables) use os mesmos nomes e faça o deploy. Veja
`.env.example` para todas as opções.

- O **SSL é detectado automaticamente**: qualquer host que não seja `localhost/127.0.0.1` conecta com
  TLS (`rejectUnauthorized: false`, como o Supabase exige). Também é possível forçar com
  `DATABASE_SSL=true|false`.
- O **pool é limitado a 5 conexões** por padrão (`DATABASE_POOL_MAX`) justamente para não estourar o
  limite do plano gratuito do Supabase com várias instâncias serverless.

## 4. Levar os dados atuais

Há dois caminhos, ambos sem perder nada:

1. **Backup JSON** (recomendado): em *Backup e restauração* → **Guardar cópia no sistema** (ou
   **Salvar no computador…**). Depois de apontar `DATABASE_URL` para o Supabase, use
   **Restaurar / importar backup** e envie o arquivo no modo *mesclar*. Datas de cadastro e
   histórico de movimentações são preservados.
2. **Planilha Excel**: exporte pela consulta (ou use o `alunos.xlsx` original) e reimporte em
   *Importar planilha* — o sistema reconhece os cabeçalhos e reaproveita os registros pelo RM.

## 5. Conferir se está tudo certo

- Abra `https://SEU-DOMINIO/api/health` — deve responder algo como:

```json
{
  "ok": true,
  "banco": { "host": "aws-0-sa-east-1.pooler.supabase.com", "porta": "6543", "ssl": true, "versao": "17.4", "estruturaCriada": true },
  "prontuarios": 6850,
  "latenciaMs": 42
}
```

- Na tela **Backup e restauração** existe o painel **“Banco de dados conectado”** mostrando servidor,
  porta, SSL, versão do PostgreSQL, ambiente (nuvem/local), latência e nº de prontuários.

## 6. Boas práticas no Supabase

- **Backups automáticos**: ative em *Database → Backups* (diários no plano Pro). Mantenha também as
  cópias internas do sistema e o `.json` salvo na nuvem da escola.
- **Segurança**: a aplicação conecta com o usuário `postgres` (dono do banco, ignora RLS). **Nunca**
  exponha a `DATABASE_URL` no front-end nem em repositório público. As chaves `anon`/`service_role`
  do Supabase não são usadas por este sistema.
- **Conexões**: em produção use sempre o pooler (porta `6543`); a porta `5432` serve para migrações
  e scripts.
- **Espaço**: 6.850 prontuários ocupam poucos MB; cada cópia interna de backup fica em torno de 1–2 MB
  e o sistema mantém no máximo 10.

---

## 7. Uso no celular e tablet

O sistema é **responsivo** e **instalável como aplicativo** (PWA):

- **Celular**: os registros aparecem em **cartões empilhados** (nome, sobrenome, RM em destaque,
  observações e botões de editar/excluir com área de toque confortável). Nada de rolar a tela para
  os lados.
- **Tablet e computador**: a tabela completa com todas as colunas.
- Menu lateral vira um botão “hambúrguer” no topo em telas pequenas.
- A régua alfabética A–Z, os filtros e a pré-visualização de impressão se reorganizam
  automaticamente em uma ou duas colunas.
- Título da aba, ícone do app e cor do tema já configurados (`#0f766e`).

### Instalar no aparelho

| Aparelho | Como instalar |
|---|---|
| Android (Chrome) | abra o endereço → menu ⋮ → **Instalar aplicativo** |
| iPhone / iPad (Safari) | abra o endereço → **Compartilhar** → **Adicionar à Tela de Início** |
| Windows / Mac (Chrome/Edge) | ícone de instalação na barra de endereços |

Depois de instalado, o ícone “Arquivo Morto” aparece na tela inicial e abre em tela cheia, com
atalhos diretos para *Consultar*, *Imprimir* e *Backup*.

## 8. Falta de energia ou de internet

**Os dados nunca ficam no aparelho do operador: ficam no PostgreSQL do servidor.** Se faltar energia
na escola ou a internet cair:

1. Nada é perdido — o servidor e o banco continuam íntegros.
2. O banco é recuperado automaticamente ao voltar (o sistema já tem reconexão automática e
   mensagens claras de “banco indisponível” em vez de erro 500).
3. A aplicação guarda **a última consulta** no aparelho (cache do service worker + cópia local) e
   mostra um aviso amarelo *“Sem conexão — exibindo a última consulta salva”*, então a secretaria
   ainda consegue ler o último resultado de busca.
4. Ao voltar a conexão, basta recarregar a página: tudo está no servidor.

### Recomendações de operação (escola)

- Instale um **nobreak (UPS)** no roteador e no computador da secretaria.
- **Uma vez por semana**: *Backup e restauração* → **Guardar cópia no sistema** (fica no servidor) e
  **Salvar no computador…** (arquivo `.json` no computador ou na nuvem da escola).
- Mantenha uma **relação impressa** (ou PDF) atualizada — útil quando não houver energia.
- Se a escola precisar operar **sem internet nenhuma**, o sistema pode rodar em um computador local
  com PostgreSQL na mesma rede: funciona pelo navegador dos outros aparelhos, e o `.json` serve para
  sincronizar quando houver conexão.
