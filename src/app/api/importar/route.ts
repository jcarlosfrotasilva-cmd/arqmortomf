import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { importacoes, prontuarios } from "@/db/schema";
import { analisarPlanilha, type LinhaPlanilha } from "@/lib/server/planilha";
import { normalizeText } from "@/lib/text";
import type { LinhaPrevia, ResultadoImportacao } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024; // 10 MB
const FORMATOS_ACEITOS = /\.(xlsx|xlsm|csv|txt)$/i;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const simular = url.searchParams.get("dryRun") !== "0";

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return Response.json({ mensagem: "Não foi possível ler o arquivo enviado." }, { status: 400 });
  }

  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File)) {
    return Response.json({ mensagem: "Selecione uma planilha para importar." }, { status: 400 });
  }
  if (arquivo.size === 0) {
    return Response.json({ mensagem: "O arquivo enviado está vazio." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    return Response.json(
      { mensagem: "Arquivo muito grande. O limite é de 10 MB por importação." },
      { status: 413 },
    );
  }

  const nomeArquivo = arquivo.name || "planilha.xlsx";
  if (!FORMATOS_ACEITOS.test(nomeArquivo)) {
    return Response.json(
      { mensagem: "Formato não suportado. Envie um arquivo .xlsx, .xlsm ou .csv." },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let analise;
  try {
    analise = await analisarPlanilha(nomeArquivo, buffer);
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Não foi possível interpretar a planilha enviada.";
    return Response.json({ mensagem }, { status: 422 });
  }

  const validas: LinhaPlanilha[] = [];
  const erros: { linha: number; mensagem: string }[] = [];
  const rmsLidos = new Map<string, number>();

  for (const linha of analise.linhas) {
    if (linha.erros.length > 0) {
      erros.push({ linha: linha.linha, mensagem: linha.erros.join(" ") });
      continue;
    }
    const anterior = rmsLidos.get(linha.rm);
    if (anterior !== undefined) {
      erros.push({
        linha: linha.linha,
        mensagem: `RM ${linha.rm} repetido na planilha (a linha ${anterior} já foi considerada).`,
      });
      continue;
    }
    rmsLidos.set(linha.rm, linha.linha);
    validas.push(linha);
  }

  if (validas.length === 0) {
    return Response.json(
      {
        mensagem:
          "Nenhuma linha válida encontrada. Confira se as colunas RM, NOME e SOBRENOME estão preenchidas.",
      },
      { status: 422 },
    );
  }

  try {
    const existentes = new Set<string>();
    for (const lote of emLotes(
      validas.map((linha) => linha.rm),
      1000,
    )) {
      const registros = await db
        .select({ rm: prontuarios.rm })
        .from(prontuarios)
        .where(inArray(prontuarios.rm, lote));
      registros.forEach((registro) => existentes.add(registro.rm));
    }

    const novos = validas.filter((linha) => !existentes.has(linha.rm)).length;
    const atualizados = validas.length - novos;

    const previa: LinhaPrevia[] = validas.slice(0, 60).map((linha) => ({
      linha: linha.linha,
      rm: linha.rm,
      nome: linha.nome,
      sobrenome: linha.sobrenome,
      situacao: existentes.has(linha.rm) ? "atualizacao" : "novo",
    }));

    const resultado: ResultadoImportacao = {
      arquivo: nomeArquivo,
      totalLinhas: analise.totalLinhas,
      linhasValidas: validas.length,
      novos,
      atualizados,
      ignorados: erros.length,
      previa,
      erros: erros.slice(0, 200),
      confirmada: false,
      importacaoId: null,
    };

    if (simular) {
      return Response.json({
        ...resultado,
        aba: analise.aba,
        colunas: analise.colunas,
        avisos: analise.avisos,
      });
    }

    for (const lote of emLotes(validas, 400)) {
      await db
        .insert(prontuarios)
        .values(
          lote.map((linha) => ({
            rm: linha.rm,
            nome: linha.nome,
            sobrenome: linha.sobrenome,
            nomeBusca: normalizeText(linha.nome),
            sobrenomeBusca: normalizeText(linha.sobrenome),
            observacoes: linha.observacoes,
          })),
        )
        .onConflictDoUpdate({
          target: prontuarios.rm,
          set: {
            nome: sql`excluded.nome`,
            sobrenome: sql`excluded.sobrenome`,
            nomeBusca: sql`excluded.nome_busca`,
            sobrenomeBusca: sql`excluded.sobrenome_busca`,
            observacoes: sql`coalesce(excluded.observacoes, ${prontuarios.observacoes})`,
            updatedAt: sql`now()`,
          },
        });
    }

    const [registro] = await db
      .insert(importacoes)
      .values({
        arquivo: nomeArquivo,
        modo: "importacao",
        totalLinhas: analise.totalLinhas,
        inseridos: novos,
        atualizados,
        ignorados: erros.length,
        erros: erros.slice(0, 200),
      })
      .returning({ id: importacoes.id });

    return Response.json({
      ...resultado,
      confirmada: true,
      importacaoId: registro?.id ?? null,
      aba: analise.aba,
      colunas: analise.colunas,
      avisos: analise.avisos,
    });
  } catch (erro) {
    console.error("[importar:POST]", erro);
    return Response.json(
      { mensagem: "Falha ao gravar os dados na base. Nenhuma linha foi importada." },
      { status: 500 },
    );
  }
}
