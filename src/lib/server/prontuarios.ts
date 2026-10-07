import {
  and,
  asc,
  desc,
  inArray,
  like,
  ne,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { importacoes, prontuarios } from "@/db/schema";
import { searchWords } from "@/lib/text";
import {
  TAMANHOS_PAGINA_CLIENTE,
  type CampoIndice,
  type Estatisticas,
  type FiltrosBusca,
  type LetraIndice,
  type ListaProntuarios,
  type Ordenacao,
  type Prontuario,
  type RegistroImportacao,
} from "@/lib/types";

type ProntuarioRow = typeof prontuarios.$inferSelect;

export const ORDENACOES: Ordenacao[] = ["sobrenome", "nome", "rm", "recentes"];

export function serializeProntuario(row: ProntuarioRow): Prontuario {
  return {
    id: row.id,
    rm: row.rm,
    nome: row.nome,
    sobrenome: row.sobrenome,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const TAMANHOS_PAGINA = TAMANHOS_PAGINA_CLIENTE;

export function parseFiltros(params: URLSearchParams): FiltrosBusca {
  const ordenarPor = (params.get("ordenarPor") ?? "sobrenome") as Ordenacao;
  const campoLetra: CampoIndice = params.get("campoLetra") === "nome" ? "nome" : "sobrenome";
  const letra = normalizarLetra(params.get("letra"));
  const pagina = Number.parseInt(params.get("pagina") ?? "1", 10);
  const tamanhoPagina = Number.parseInt(params.get("tamanhoPagina") ?? "25", 10);
  const direcao = params.get("direcao") === "desc" ? "desc" : "asc";

  return {
    nome: (params.get("nome") ?? "").trim(),
    sobrenome: (params.get("sobrenome") ?? "").trim(),
    rm: (params.get("rm") ?? "").trim(),
    letra,
    campoLetra,
    ordenarPor: ORDENACOES.includes(ordenarPor) ? ordenarPor : "sobrenome",
    direcao,
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
    tamanhoPagina: TAMANHOS_PAGINA.includes(tamanhoPagina) ? tamanhoPagina : 25,
  };
}

/**
 * Busca por prefixo de palavra: cada palavra digitada precisa INICIAR uma das
 * palavras do campo. Assim "ana" retorna "Ana", "Ana Clara" e "Ana Paula",
 * mas não "Mariana" nem "Joana".
 */
function condicaoPrefixo(coluna: AnyColumn, termo: string): SQL | undefined {
  const palavras = searchWords(termo).map((palavra) => palavra.replace(/[%_\\]/g, ""));
  const validas = palavras.filter((palavra) => palavra.length > 0);
  if (validas.length === 0) return undefined;

  const partes = validas.map((palavra) =>
    or(
      like(coluna, `${palavra}%`),
      like(coluna, `% ${palavra}%`),
    ),
  );

  return partes.length === 1 ? partes[0] : and(...partes);
}

/** Converte "Á", "a" ou " A " em "a"; "#" representa números/símbolos. */
export function normalizarLetra(valor: string | null | undefined): string {
  if (!valor) return "";
  if (valor.trim() === "#") return "#";
  const letra = searchWords(valor)[0]?.charAt(0) ?? "";
  return /^[a-z0-9]$/.test(letra) ? letra : "";
}

function colunaIndice(campo: CampoIndice) {
  return campo === "nome" ? prontuarios.nomeBusca : prontuarios.sobrenomeBusca;
}

function condicoesBusca(filtros: {
  nome?: string;
  sobrenome?: string;
  rm?: string;
  letra?: string;
  campoLetra?: CampoIndice;
}): SQL[] {
  const condicoes: SQL[] = [];

  const nome = condicaoPrefixo(prontuarios.nomeBusca, filtros.nome ?? "");
  const sobrenome = condicaoPrefixo(prontuarios.sobrenomeBusca, filtros.sobrenome ?? "");
  if (nome) condicoes.push(nome);
  if (sobrenome) condicoes.push(sobrenome);

  const rmBruto = (filtros.rm ?? "").toUpperCase().replace(/[%_\\]/g, "");
  if (rmBruto) {
    condicoes.push(like(sql`upper(${prontuarios.rm})`, `%${rmBruto}%`));
  }

  const letra = normalizarLetra(filtros.letra);
  if (letra) {
    const coluna = colunaIndice(filtros.campoLetra ?? "sobrenome");
    condicoes.push(
      letra === "#"
        ? sql`${coluna} !~ '^[a-z]'`
        : like(coluna, `${letra}%`),
    );
  }

  return condicoes;
}

/**
 * Índice alfabético: quantos registros começam com cada letra, respeitando os
 * filtros ativos (nome, sobrenome e RM) e ignorando a própria letra selecionada.
 */
export async function obterIndiceLetras(
  filtros: { nome?: string; sobrenome?: string; rm?: string },
  campo: CampoIndice,
): Promise<{ letras: LetraIndice[]; total: number }> {
  const condicoes = condicoesBusca(filtros);
  const where = condicoes.length > 0 ? and(...condicoes) : undefined;
  const coluna = colunaIndice(campo);

  const linhas = await db
    .select({
      letra: sql<string>`lower(substr(${coluna}, 1, 1))`,
      total: sql<number>`count(*)::int`,
    })
    .from(prontuarios)
    .where(where)
    .groupBy(sql`lower(substr(${coluna}, 1, 1))`)
    .orderBy(sql`lower(substr(${coluna}, 1, 1))`);

  const letras: LetraIndice[] = [];
  let total = 0;
  let outros = 0;

  for (const linha of linhas) {
    const letra = (linha.letra ?? "").trim();
    total += linha.total;
    if (/^[a-z]$/.test(letra)) {
      letras.push({ letra: letra.toUpperCase(), total: linha.total });
      continue;
    }
    // Iniciais numéricas ou símbolos (inclusive sobrenome só com pontuação).
    outros += linha.total;
  }

  if (outros > 0) {
    letras.push({ letra: "#", total: outros });
  }

  return { letras, total };
}

function ordenacaoSql(filtros: FiltrosBusca): SQL[] {
  const dir = filtros.direcao === "desc" ? desc : asc;
  switch (filtros.ordenarPor) {
    case "nome":
      return [dir(prontuarios.nomeBusca), asc(prontuarios.sobrenomeBusca)];
    case "rm":
      return [dir(prontuarios.rm)];
    case "recentes":
      return [desc(prontuarios.createdAt)];
    case "sobrenome":
    default:
      return [
        dir(prontuarios.sobrenomeBusca),
        asc(prontuarios.nomeBusca),
        asc(prontuarios.rm),
      ];
  }
}

export async function listarProntuarios(
  filtros: FiltrosBusca,
): Promise<ListaProntuarios> {
  const condicoes = condicoesBusca(filtros);
  const where = condicoes.length > 0 ? and(...condicoes) : undefined;

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(prontuarios)
    .where(where);

  const total = totalRow?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / filtros.tamanhoPagina));
  const pagina = Math.min(filtros.pagina, totalPaginas);

  const linhas = await db
    .select()
    .from(prontuarios)
    .where(where)
    .orderBy(...ordenacaoSql(filtros))
    .limit(filtros.tamanhoPagina)
    .offset((pagina - 1) * filtros.tamanhoPagina);

  return {
    itens: linhas.map(serializeProntuario),
    total,
    pagina,
    tamanhoPagina: filtros.tamanhoPagina,
    totalPaginas,
  };
}

export async function listarProntuariosParaExportacao(
  filtros: FiltrosBusca,
  limite = 20000,
): Promise<Prontuario[]> {
  const condicoes = condicoesBusca(filtros);
  const where = condicoes.length > 0 ? and(...condicoes) : undefined;
  const linhas = await db
    .select()
    .from(prontuarios)
    .where(where)
    .orderBy(...ordenacaoSql(filtros))
    .limit(limite);
  return linhas.map(serializeProntuario);
}

export async function obterEstatisticas(): Promise<Estatisticas> {
  const [agregados] = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalSobrenomes: sql<number>`count(distinct ${prontuarios.sobrenomeBusca})::int`,
      totalUltimosSeteDias: sql<number>`count(*) filter (where ${prontuarios.createdAt} >= now() - interval '7 days')::int`,
    })
    .from(prontuarios);

  const [ultima] = await db
    .select({
      arquivo: importacoes.arquivo,
      inseridos: importacoes.inseridos,
      atualizados: importacoes.atualizados,
      ignorados: importacoes.ignorados,
      createdAt: importacoes.createdAt,
    })
    .from(importacoes)
    .where(ne(importacoes.modo, "backup"))
    .orderBy(desc(importacoes.createdAt))
    .limit(1);

  return {
    total: agregados?.total ?? 0,
    totalSobrenomes: agregados?.totalSobrenomes ?? 0,
    totalUltimosSeteDias: agregados?.totalUltimosSeteDias ?? 0,
    ultimaImportacao: ultima
      ? {
          arquivo: ultima.arquivo,
          inseridos: ultima.inseridos,
          atualizados: ultima.atualizados,
          ignorados: ultima.ignorados,
          createdAt: ultima.createdAt.toISOString(),
        }
      : null,
  };
}

export async function listarImportacoes(
  limite = 30,
  tipos?: string[],
): Promise<RegistroImportacao[]> {
  const filtro =
    tipos && tipos.length > 0 ? inArray(importacoes.modo, tipos) : undefined;

  const linhas = await db
    .select()
    .from(importacoes)
    .where(filtro)
    .orderBy(desc(importacoes.createdAt))
    .limit(limite);

  return linhas.map((linha) => ({
    id: linha.id,
    arquivo: linha.arquivo,
    modo: linha.modo,
    totalLinhas: linha.totalLinhas,
    inseridos: linha.inseridos,
    atualizados: linha.atualizados,
    ignorados: linha.ignorados,
    erros: linha.erros ?? [],
    createdAt: linha.createdAt.toISOString(),
  }));
}
