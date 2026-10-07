import { sql } from "drizzle-orm";
import { db, descricaoBanco } from "@/db";
import type { InfoBanco } from "@/components/BancoPanel";

/** Coleta informações do banco conectado para exibir na tela (sem expor credenciais). */
export async function obterInfoBanco(): Promise<InfoBanco> {
  const base = descricaoBanco();
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

    return {
      ...base,
      versao: versao.rows[0]?.versao ?? "desconhecida",
      estruturaCriada,
      prontuarios,
      latenciaMs: Date.now() - inicio,
    };
  } catch {
    return {
      ...base,
      versao: "indisponível",
      estruturaCriada: false,
      prontuarios: null,
      latenciaMs: Date.now() - inicio,
    };
  }
}
