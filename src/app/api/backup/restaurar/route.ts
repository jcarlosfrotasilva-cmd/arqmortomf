import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { importacoes, prontuarios } from "@/db/schema";
import { analisarPlanilha } from "@/lib/server/planilha";
import {
  analisarBackupJson,
  dadosProntuario,
  deduplicarLinhas,
  obterBackupSalvo,
  type AnaliseBackup,
  type LinhaRestauracao,
} from "@/lib/server/backup";
import type { LinhaPrevia } from "@/lib/types";
import { respostaErro } from "@/lib/server/erros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMANHO_MAXIMO = 25 * 1024 * 1024; // 25 MB

type Modo = "mesclar" | "substituir";

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

function linhasDaPlanilha(
  analise: Awaited<ReturnType<typeof analisarPlanilha>>,
): AnaliseBackup {
  const linhas: LinhaRestauracao[] = [];
  const erros: { linha: number; mensagem: string }[] = [];

  for (const item of analise.linhas) {
    if (item.erros.length > 0) {
      erros.push({ linha: item.linha, mensagem: item.erros.join(" ") });
      continue;
    }
    linhas.push({
      linha: item.linha,
      rm: item.rm,
      nome: item.nome,
      sobrenome: item.sobrenome,
      observacoes: item.observacoes,
    });
  }

  return {
    formato: "planilha",
    linhas,
    erros,
    avisos: [
      `Restauração a partir de planilha (aba "${analise.aba}", ${analise.totalLinhas} linha(s) de dados).`,
      "Ao restaurar por planilha, os campos não presentes no arquivo permanecem como estão no sistema e as datas de cadastro atuais são mantidas.",
      ...analise.avisos,
    ],
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const simular = url.searchParams.get("dryRun") !== "0";
  const modo: Modo = url.searchParams.get("modo") === "substituir" ? "substituir" : "mesclar";

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return Response.json({ mensagem: "Não foi possível ler o arquivo enviado." }, { status: 400 });
  }

  const arquivo = formulario.get("arquivo");
  const backupIdBruto = formulario.get("backupId");

  let nomeArquivo: string;
  let ext: string;
  let buffer: Buffer;

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > TAMANHO_MAXIMO) {
      return Response.json(
        { mensagem: "Arquivo muito grande. O limite para restauração é de 25 MB." },
        { status: 413 },
      );
    }

    nomeArquivo = arquivo.name || "backup.json";
    ext = nomeArquivo.toLowerCase().split(".").pop() ?? "";
    const aceitos = ["json", "xlsx", "xlsm", "csv", "txt"];
    if (!aceitos.includes(ext)) {
      return Response.json(
        {
          mensagem:
            "Formato não suportado. Envie o backup .json gerado pelo sistema ou uma planilha .xlsx/.xlsm/.csv.",
        },
        { status: 415 },
      );
    }

    buffer = Buffer.from(await arquivo.arrayBuffer());
  } else if (typeof backupIdBruto === "string" && backupIdBruto.trim()) {
    const backupId = Number.parseInt(backupIdBruto, 10);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return Response.json({ mensagem: "Cópia de segurança inválida." }, { status: 400 });
    }

    const salvo = await obterBackupSalvo(backupId);
    if (!salvo) {
      return Response.json(
        { mensagem: "Cópia de segurança não encontrada no sistema. Atualize a página e tente novamente." },
        { status: 404 },
      );
    }

    nomeArquivo = salvo.nome;
    ext = "json";
    buffer = Buffer.from(salvo.conteudo, "utf8");
  } else {
    return Response.json(
      { mensagem: "Selecione o arquivo de backup (.json), uma planilha de prontuários ou uma cópia guardada no sistema." },
      { status: 400 },
    );
  }

  let analise: AnaliseBackup;
  try {
    analise =
      ext === "json"
        ? analisarBackupJson(buffer.toString("utf8"))
        : linhasDaPlanilha(await analisarPlanilha(nomeArquivo, buffer));
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Não foi possível interpretar o arquivo enviado.";
    return Response.json({ mensagem }, { status: 422 });
  }

  const deduplicado = deduplicarLinhas(analise.linhas);
  const erros = [...analise.erros, ...deduplicado.erros];
  const linhas = deduplicado.linhas;

  if (linhas.length === 0) {
    return Response.json(
      {
        mensagem:
          "Nenhum registro válido encontrado no arquivo. Confira se é um backup gerado pelo sistema ou uma planilha com RM, nome e sobrenome.",
      },
      { status: 422 },
    );
  }

  try {
    const existentes = new Set<string>();
    for (const lote of emLotes(
      linhas.map((linha) => linha.rm),
      1000,
    )) {
      const registros = await db
        .select({ rm: prontuarios.rm })
        .from(prontuarios)
        .where(inArray(prontuarios.rm, lote));
      registros.forEach((registro) => existentes.add(registro.rm));
    }

    const [totalAtual] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(prontuarios);

    const novos = linhas.filter((linha) => !existentes.has(linha.rm)).length;
    const atualizados = linhas.length - novos;
    const previa: LinhaPrevia[] = linhas.slice(0, 60).map((linha) => ({
      linha: linha.linha,
      rm: linha.rm,
      nome: linha.nome,
      sobrenome: linha.sobrenome,
      situacao: existentes.has(linha.rm) ? "atualizacao" : "novo",
    }));

    const avisos = [...analise.avisos];
    if (modo === "substituir") {
      avisos.push(
        `Modo substituir: ${totalAtual?.total ?? 0} prontuário(s) atual(is) serão apagados e o acervo ficará exatamente igual ao arquivo.`,
      );
    } else {
      avisos.push(
        "Modo mesclar: registros com RM já existente são atualizados e os demais são incluídos, sem apagar nada.",
      );
    }

    const resultado = {
      arquivo: nomeArquivo,
      formato: analise.formato,
      modo,
      totalLinhas: linhas.length,
      linhasValidas: linhas.length,
      novos,
      atualizados,
      ignorados: erros.length,
      previa,
      erros: erros.slice(0, 200),
      avisos,
      confirmada: false,
      importacaoId: null as number | null,
    };

    if (simular) {
      return Response.json(resultado);
    }

    const importacaoId = await db.transaction(async (tx) => {
      if (modo === "substituir") {
        await tx.delete(prontuarios);
      }

      for (const lote of emLotes(linhas, 300)) {
        const valores = lote.map(dadosProntuario);
        if (modo === "substituir") {
          await tx.insert(prontuarios).values(valores);
        } else {
          await tx
            .insert(prontuarios)
            .values(valores)
            .onConflictDoUpdate({
              target: prontuarios.rm,
              set: {
                nome: sql`excluded.nome`,
                sobrenome: sql`excluded.sobrenome`,
                nomeBusca: sql`excluded.nome_busca`,
                sobrenomeBusca: sql`excluded.sobrenome_busca`,
                observacoes: sql`coalesce(excluded.observacoes, ${prontuarios.observacoes})`,
                updatedAt: sql`coalesce(excluded.updated_at, now())`,
              },
            });
        }
      }

      const [registro] = await tx
        .insert(importacoes)
        .values({
          arquivo: nomeArquivo,
          modo: modo === "substituir" ? "restauracao-total" : "restauracao-mesclar",
          totalLinhas: linhas.length,
          inseridos: novos,
          atualizados,
          ignorados: erros.length,
          erros: erros.slice(0, 200),
        })
        .returning({ id: importacoes.id });

      return registro?.id ?? null;
    });

    return Response.json({ ...resultado, confirmada: true, importacaoId });
  } catch (erro) {
    return respostaErro("backup:restaurar", erro, "Falha ao restaurar o backup. Nenhuma alteração foi aplicada ao acervo.");
  }
}
