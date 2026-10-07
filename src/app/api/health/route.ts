import { sql } from "drizzle-orm";
import { db, descricaoBanco } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Verificação de saúde: valida a conexão, informa versão do PostgreSQL e, se o
 * schema já existir, quantos prontuários estão no arquivo morto.
 */
export async function GET() {
  const inicio = Date.now();

  try {
    const versao = await db.execute<{ versao: string }>(
      sql`select current_setting('server_version') as versao`,
    );

    let prontuarios: number | null = null;
    let estruturaCriada = false;

    try {
      const contagem = await db.execute<{ total: number }>(
        sql`select count(*)::int as total from prontuarios`,
      );
      prontuarios = contagem.rows[0]?.total ?? 0;
      estruturaCriada = true;
    } catch {
      estruturaCriada = false;
    }

    return Response.json({
      ok: true,
      banco: {
        ...descricaoBanco(),
        versao: versao.rows[0]?.versao ?? "desconhecida",
        estruturaCriada,
      },
      prontuarios,
      dica: estruturaCriada
        ? undefined
        : "Conexão OK, mas o schema ainda não existe. Rode: DATABASE_URL=... node scripts/setup-supabase.mjs",
      latenciaMs: Date.now() - inicio,
      verificadoEm: new Date().toISOString(),
    });
  } catch (erro) {
    console.error("[health]", erro);
    return Response.json(
      {
        ok: false,
        banco: descricaoBanco(),
        mensagem: erro instanceof Error ? erro.message : "Falha ao consultar o banco de dados.",
      },
      { status: 500 },
    );
  }
}
