import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { backupArquivos, importacoes, prontuarios } from "@/db/schema";
import { ESCOLA } from "@/lib/escola";
import { normalizeText } from "@/lib/text";
import type { BackupSalvo } from "@/lib/types";

export const VERSAO_BACKUP = 1;

export type BackupProntuario = {
  rm: string;
  nome: string;
  sobrenome: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupHistorico = {
  arquivo: string;
  modo: string;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  createdAt: string;
};

export type BackupPayload = {
  aplicacao: string;
  escola: string;
  versao: number;
  geradoEm: string;
  totais: { prontuarios: number; lotesHistorico: number };
  prontuarios: BackupProntuario[];
  historico: BackupHistorico[];
};

export type LinhaRestauracao = {
  linha: number;
  rm: string;
  nome: string;
  sobrenome: string;
  observacoes: string | null;
  /** Preservados quando o arquivo é um backup do sistema. */
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AnaliseBackup = {
  formato: "backup-json" | "planilha";
  linhas: LinhaRestauracao[];
  erros: { linha: number; mensagem: string }[];
  avisos: string[];
};

/** Monta o conteúdo completo do arquivo de backup do acervo. */
export async function montarBackup(): Promise<BackupPayload> {
  const registros = await db
    .select({
      rm: prontuarios.rm,
      nome: prontuarios.nome,
      sobrenome: prontuarios.sobrenome,
      observacoes: prontuarios.observacoes,
      createdAt: prontuarios.createdAt,
      updatedAt: prontuarios.updatedAt,
    })
    .from(prontuarios)
    .orderBy(prontuarios.sobrenomeBusca, prontuarios.nomeBusca, prontuarios.rm);

  const historico = await db
    .select({
      arquivo: importacoes.arquivo,
      modo: importacoes.modo,
      totalLinhas: importacoes.totalLinhas,
      inseridos: importacoes.inseridos,
      atualizados: importacoes.atualizados,
      ignorados: importacoes.ignorados,
      createdAt: importacoes.createdAt,
    })
    .from(importacoes)
    .orderBy(desc(importacoes.createdAt))
    .limit(500);

  return {
    aplicacao: `Arquivo Morto Escolar · ${ESCOLA.sistema}`,
    escola: ESCOLA.identificacao,
    versao: VERSAO_BACKUP,
    geradoEm: new Date().toISOString(),
    totais: { prontuarios: registros.length, lotesHistorico: historico.length },
    prontuarios: registros.map((registro) => ({
      rm: registro.rm,
      nome: registro.nome,
      sobrenome: registro.sobrenome,
      observacoes: registro.observacoes,
      createdAt: registro.createdAt.toISOString(),
      updatedAt: registro.updatedAt.toISOString(),
    })),
    historico: historico.map((item) => ({
      arquivo: item.arquivo,
      modo: item.modo,
      totalLinhas: item.totalLinhas,
      inseridos: item.inseridos,
      atualizados: item.atualizados,
      ignorados: item.ignorados,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export function nomeArquivoBackup(): string {
  const agora = new Date();
  const data = agora.toISOString().slice(0, 10);
  const hora = `${String(agora.getHours()).padStart(2, "0")}h${String(agora.getMinutes()).padStart(2, "0")}`;
  return `backup-arquivo-morto-marlene-frattini-${data}-${hora}.json`;
}

function comoLista(valor: unknown): unknown[] | null {
  return Array.isArray(valor) ? valor : null;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

/**
 * Lê um arquivo de backup gerado pelo sistema (JSON) de forma tolerante:
 * aceita o formato oficial e variações simples (chave `registros`/`data`),
 * relatando linha por linha o que não puder ser aproveitado.
 */
export function analisarBackupJson(conteudo: string): AnaliseBackup {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo) as unknown;
  } catch {
    throw new Error(
      "O arquivo não é um backup válido: não foi possível interpretar o JSON. Verifique se o download não foi interrompido.",
    );
  }

  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new Error("O arquivo não é um backup válido: estrutura inesperada.");
  }

  const objeto = bruto as Record<string, unknown>;
  const lista =
    comoLista(objeto.prontuarios) ??
    comoLista(objeto.registros) ??
    comoLista(objeto.data) ??
    null;

  if (!lista) {
    throw new Error(
      "Backup inválido: não encontramos a lista de prontuários. Use um arquivo gerado por “Baixar backup completo”.",
    );
  }

  const avisos: string[] = [];
  const versao = Number(objeto.versao);
  if (Number.isFinite(versao) && versao > VERSAO_BACKUP) {
    avisos.push(
      `O backup foi gerado por uma versão mais nova do sistema (v${versao}). Confira os dados após restaurar.`,
    );
  }
  if (typeof objeto.escola === "string" && objeto.escola.trim()) {
    avisos.push(`Backup de origem: ${objeto.escola.trim()}.`);
  }
  if (typeof objeto.geradoEm === "string") {
    const data = new Date(objeto.geradoEm);
    if (!Number.isNaN(data.getTime())) {
      avisos.push(
        `Gerado em ${data.toLocaleString("pt-BR")} — confirme se é a cópia mais recente antes de substituir o acervo.`,
      );
    }
  }

  const linhas: LinhaRestauracao[] = [];
  const erros: { linha: number; mensagem: string }[] = [];

  lista.forEach((item, indice) => {
    const numero = indice + 1;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      erros.push({ linha: numero, mensagem: "Registro em formato inválido." });
      return;
    }

    const registro = item as Record<string, unknown>;
    const rm = texto(registro.rm).toUpperCase().replace(/\s+/g, "").slice(0, 30);
    const nome = texto(registro.nome).slice(0, 120);
    const sobrenome = texto(registro.sobrenome).slice(0, 160);
    const observacoes = texto(registro.observacoes).slice(0, 1000) || null;

    const dataValida = (valor: unknown): string | null => {
      if (typeof valor !== "string" || !valor.trim()) return null;
      const data = new Date(valor);
      return Number.isNaN(data.getTime()) ? null : data.toISOString();
    };
    const createdAt = dataValida(registro.createdAt);
    const updatedAt = dataValida(registro.updatedAt);

    if (!rm || !nome || !sobrenome) {
      erros.push({
        linha: numero,
        mensagem: "Registro sem RM, nome ou sobrenome — não pode ser restaurado.",
      });
      return;
    }

    linhas.push({ linha: numero, rm, nome, sobrenome, observacoes, createdAt, updatedAt });
  });

  return { formato: "backup-json", linhas, erros, avisos };
}

/** Deduplica RMs dentro do arquivo, mantendo a última ocorrência. */
export function deduplicarLinhas(linhas: LinhaRestauracao[]): {
  linhas: LinhaRestauracao[];
  erros: { linha: number; mensagem: string }[];
} {
  const porRm = new Map<string, LinhaRestauracao>();
  const erros: { linha: number; mensagem: string }[] = [];

  for (const linha of linhas) {
    const anterior = porRm.get(linha.rm);
    if (anterior) {
      erros.push({
        linha: linha.linha,
        mensagem: `RM ${linha.rm} repetido no arquivo (mantida a última ocorrência, da linha ${linha.linha}).`,
      });
    }
    porRm.set(linha.rm, linha);
  }

  return { linhas: [...porRm.values()], erros };
}

export const rotuloModo: Record<string, string> = {
  importacao: "Importação de planilha",
  "restauracao-mesclar": "Restauração (mesclar)",
  "restauracao-total": "Restauração (substituir acervo)",
  backup: "Backup gerado",
};

export function dadosProntuario(linha: LinhaRestauracao) {
  const base = {
    rm: linha.rm,
    nome: linha.nome,
    sobrenome: linha.sobrenome,
    nomeBusca: normalizeText(linha.nome),
    sobrenomeBusca: normalizeText(linha.sobrenome),
    observacoes: linha.observacoes,
  };

  const createdAt = linha.createdAt ? new Date(linha.createdAt) : null;
  const updatedAt = linha.updatedAt ? new Date(linha.updatedAt) : null;

  return {
    ...base,
    ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}),
    ...(updatedAt && !Number.isNaN(updatedAt.getTime()) ? { updatedAt } : {}),
  };
}


export function serializeBackupSalvo(registro: {
  id: number;
  nome: string;
  tamanhoBytes: number;
  totalRegistros: number;
  createdAt: Date;
}): BackupSalvo {
  return {
    id: registro.id,
    nome: registro.nome,
    tamanhoBytes: registro.tamanhoBytes,
    totalRegistros: registro.totalRegistros,
    createdAt: registro.createdAt.toISOString(),
  };
}

const MAX_COPIAS_GUARDADAS = 10;

/** Mantém no máximo 10 cópias internas, removendo as mais antigas. */
async function podarCopiasAntigas(): Promise<void> {
  await db.execute(sql`
    delete from backup_arquivos
    where id not in (
      select id from backup_arquivos order by created_at desc limit ${MAX_COPIAS_GUARDADAS}
    )
  `);
}

/** Gera o backup e guarda uma cópia dentro do próprio sistema. */
export async function salvarBackupNoSistema(): Promise<BackupSalvo> {
  const backup = await montarBackup();
  const conteudo = JSON.stringify(backup, null, 2);
  const nome = nomeArquivoBackup();

  const [registro] = await db
    .insert(backupArquivos)
    .values({
      nome,
      conteudo,
      tamanhoBytes: Buffer.byteLength(conteudo, "utf8"),
      totalRegistros: backup.totais.prontuarios,
    })
    .returning({
      id: backupArquivos.id,
      nome: backupArquivos.nome,
      tamanhoBytes: backupArquivos.tamanhoBytes,
      totalRegistros: backupArquivos.totalRegistros,
      createdAt: backupArquivos.createdAt,
    });

  await db.insert(importacoes).values({
    arquivo: nome,
    modo: "backup",
    totalLinhas: backup.totais.prontuarios,
    inseridos: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
  });

  await podarCopiasAntigas();

  return serializeBackupSalvo(registro);
}

export async function listarBackupsSalvos(limite = 20): Promise<BackupSalvo[]> {
  const registros = await db
    .select({
      id: backupArquivos.id,
      nome: backupArquivos.nome,
      tamanhoBytes: backupArquivos.tamanhoBytes,
      totalRegistros: backupArquivos.totalRegistros,
      createdAt: backupArquivos.createdAt,
    })
    .from(backupArquivos)
    .orderBy(desc(backupArquivos.createdAt))
    .limit(limite);

  return registros.map(serializeBackupSalvo);
}

export async function obterBackupSalvo(
  id: number,
): Promise<{ nome: string; conteudo: string } | null> {
  const [registro] = await db
    .select({ nome: backupArquivos.nome, conteudo: backupArquivos.conteudo })
    .from(backupArquivos)
    .where(eq(backupArquivos.id, id))
    .limit(1);

  return registro ?? null;
}

export async function excluirBackupSalvo(id: number): Promise<boolean> {
  const removidos = await db
    .delete(backupArquivos)
    .where(eq(backupArquivos.id, id))
    .returning({ id: backupArquivos.id });

  return removidos.length > 0;
}
