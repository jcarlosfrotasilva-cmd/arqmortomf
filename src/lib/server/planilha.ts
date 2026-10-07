import ExcelJS from "exceljs";
import { formatRm, normalizeText, toTitleCase } from "@/lib/text";

export type CampoPlanilha = "rm" | "nome" | "sobrenome" | "observacoes";

export type LinhaPlanilha = {
  linha: number;
  rm: string;
  nome: string;
  sobrenome: string;
  observacoes: string | null;
  erros: string[];
};

export type ColunasPlanilha = {
  rm: number;
  nome: number;
  sobrenome: number;
  observacoes: number | null;
};

export type AnalisePlanilha = {
  aba: string;
  linhaCabecalho: number;
  colunas: ColunasPlanilha;
  linhas: LinhaPlanilha[];
  totalLinhas: number;
  avisos: string[];
};

const CAMPOS: { campo: CampoPlanilha; termos: string[] }[] = [
  {
    campo: "rm",
    termos: ["rm", "registro do aluno", "registro", "matricula", "ra", "codigo do aluno", "codigo"],
  },
  {
    campo: "sobrenome",
    termos: [
      "sobrenome",
      "sobre nome",
      "ultimo nome",
      "ultimo sobrenome",
      "nome de familia",
      "sobrenomes",
    ],
  },
  {
    campo: "observacoes",
    termos: ["observacoes", "observacao", "obs", "notas", "nota", "comentarios", "comentario"],
  },
  {
    campo: "nome",
    termos: ["nome", "nome do aluno", "primeiro nome", "nome proprio", "aluno", "estudante"],
  },
];

const TERMOS_FORTES: { campo: CampoPlanilha; termos: string[] }[] = [
  { campo: "rm", termos: ["matricula", "registro"] },
  { campo: "sobrenome", termos: ["sobrenome"] },
  { campo: "observacoes", termos: ["observacoes"] },
];

function identificarCampo(valor: string): CampoPlanilha | null {
  const texto = normalizeText(valor);
  if (!texto) return null;

  for (const { campo, termos } of CAMPOS) {
    if (
      termos.some(
        (termo) => texto === termo || texto.startsWith(`${termo} `) || texto.endsWith(` ${termo}`),
      )
    ) {
      return campo;
    }
  }

  for (const { campo, termos } of TERMOS_FORTES) {
    if (termos.some((termo) => texto.includes(termo))) return campo;
  }
  if (texto.includes("aluno") || texto.includes("nome")) return "nome";
  return null;
}

type Grid = { nome: string; linhas: string[][] };

function gridDoWorksheet(worksheet: ExcelJS.Worksheet): Grid {
  const linhas: string[][] = [];
  const totalColunas = Math.max(worksheet.columnCount, 3);

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const valores: string[] = [];
    for (let coluna = 1; coluna <= totalColunas; coluna += 1) {
      valores.push(celulaTexto(row.getCell(coluna).value));
    }
    linhas.push(valores);
  });

  return { nome: worksheet.name, linhas };
}

function celulaTexto(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((parte) => parte.text ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return celulaTexto(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return (value.text ?? value.hyperlink).toString().trim();
    }
  }

  return String(value).trim();
}

function parseCsv(texto: string, delimitador: string): string[][] {
  const linhas: string[][] = [];
  let atual: string[] = [];
  let campo = "";
  let aspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const char = texto[i];

    if (aspas) {
      if (char === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          aspas = false;
        }
      } else {
        campo += char;
      }
      continue;
    }

    if (char === '"') {
      aspas = true;
    } else if (char === delimitador) {
      atual.push(campo.trim());
      campo = "";
    } else if (char === "\n") {
      atual.push(campo.trim());
      linhas.push(atual);
      atual = [];
      campo = "";
    } else if (char !== "\r") {
      campo += char;
    }
  }

  if (campo.length > 0 || atual.length > 0) {
    atual.push(campo.trim());
    linhas.push(atual);
  }

  return linhas;
}

function gridCsv(nome: string, buffer: Buffer): Grid {
  const texto = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? "";
  const pontosVirgula = (primeiraLinha.match(/;/g) ?? []).length;
  const pontosVirgula2 = (primeiraLinha.match(/,/g) ?? []).length;
  const delimitador = pontosVirgula >= pontosVirgula2 ? ";" : ",";
  return { nome, linhas: parseCsv(texto, delimitador) };
}

async function lerGrids(nomeArquivo: string, buffer: Buffer): Promise<Grid[]> {
  if (/\.(csv|txt)$/i.test(nomeArquivo)) {
    return [gridCsv(nomeArquivo, buffer)];
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error(
      "Não foi possível abrir o arquivo. Envie uma planilha Excel (.xlsx/.xlsm) ou um arquivo CSV válido.",
    );
  }

  const grids: Grid[] = [];
  workbook.eachSheet((worksheet) => {
    grids.push(gridDoWorksheet(worksheet));
  });

  if (grids.length === 0) {
    throw new Error("A planilha não contém nenhuma aba com dados.");
  }
  return grids;
}

function detectarColunas(grid: Grid): { colunas: ColunasPlanilha; linhaCabecalho: number } | null {
  const limite = Math.min(grid.linhas.length, 15);

  for (let indice = 0; indice < limite; indice += 1) {
    const linha = grid.linhas[indice] ?? [];
    const encontrados = new Map<CampoPlanilha, number>();

    linha.forEach((valor, coluna) => {
      const campo = identificarCampo(valor);
      if (campo && !encontrados.has(campo)) encontrados.set(campo, coluna);
    });

    const rm = encontrados.get("rm");
    const nome = encontrados.get("nome");
    const sobrenome = encontrados.get("sobrenome");
    if (rm === undefined || nome === undefined || sobrenome === undefined) continue;

    return {
      linhaCabecalho: indice,
      colunas: {
        rm,
        nome,
        sobrenome,
        observacoes: encontrados.get("observacoes") ?? null,
      },
    };
  }

  return null;
}

function textoDaCelula(linha: string[], coluna: number | null): string {
  if (coluna === null) return "";
  return (linha[coluna] ?? "").trim();
}

function analisarLinha(linha: string[], numero: number, colunas: ColunasPlanilha): LinhaPlanilha {
  const erros: string[] = [];

  const rmBruto = textoDaCelula(linha, colunas.rm);
  const nomeBruto = textoDaCelula(linha, colunas.nome);
  const sobrenomeBruto = textoDaCelula(linha, colunas.sobrenome);
  const observacoesBruto = textoDaCelula(linha, colunas.observacoes);

  const rm = formatRm(rmBruto);
  const nome = toTitleCase(nomeBruto);
  const sobrenome = toTitleCase(sobrenomeBruto);

  if (!rmBruto) erros.push("RM não informado.");
  else if (rm.length === 0) erros.push("RM inválido (use letras, números, ponto, hífen ou barra).");
  else if (rm.length > 30) erros.push("RM com mais de 30 caracteres.");

  if (!nome) erros.push("Nome não informado.");
  else if (nome.length > 120) erros.push("Nome com mais de 120 caracteres.");

  if (!sobrenome) erros.push("Sobrenome não informado.");
  else if (sobrenome.length > 160) erros.push("Sobrenome com mais de 160 caracteres.");

  return {
    linha: numero,
    rm,
    nome,
    sobrenome,
    observacoes: observacoesBruto ? observacoesBruto.slice(0, 1000) : null,
    erros,
  };
}

/** Lê o arquivo enviado (XLSX, XLSM ou CSV) e devolve as linhas já validadas. */
export async function analisarPlanilha(
  nomeArquivo: string,
  buffer: Buffer,
): Promise<AnalisePlanilha> {
  const grids = await lerGrids(nomeArquivo, buffer);

  let escolhida: {
    grid: Grid;
    colunas: ColunasPlanilha;
    linhaCabecalho: number;
    aviso: string | null;
  } | null = null;

  for (const grid of grids) {
    const deteccao = detectarColunas(grid);
    if (deteccao) {
      escolhida = { grid, colunas: deteccao.colunas, linhaCabecalho: deteccao.linhaCabecalho, aviso: null };
      break;
    }
  }

  if (!escolhida) {
    const grid = grids[0];
    const temConteudo = grid.linhas.some((linha) => linha.some((celula) => celula.length > 0));
    if (!temConteudo) {
      throw new Error("Arquivo vazio: nenhuma linha de dados encontrada na planilha.");
    }
    const primeiraCelula = identificarCampo(grid.linhas[0]?.[0] ?? "");
    escolhida = {
      grid,
      colunas: { rm: 0, nome: 1, sobrenome: 2, observacoes: null },
      linhaCabecalho: primeiraCelula === "rm" ? 0 : -1,
      aviso:
        "Cabeçalho não reconhecido: consideramos a ordem padrão das colunas (A = RM, B = NOME, C = SOBRENOME). Confira a conferência abaixo antes de confirmar.",
    };
  }

  const { grid, colunas, linhaCabecalho, aviso } = escolhida;
  const linhas: LinhaPlanilha[] = [];
  const inicio = linhaCabecalho >= 0 ? linhaCabecalho + 1 : 0;

  for (let indice = inicio; indice < grid.linhas.length; indice += 1) {
    const linha = grid.linhas[indice] ?? [];
    const vazia = linha.every((celula) => celula.trim().length === 0);
    if (vazia) continue;

    const numero = indice + 1;
    const rmBruto = textoDaCelula(linha, colunas.rm);
    if (normalizeText(`${rmBruto} ${textoDaCelula(linha, colunas.nome)}`) === "") continue;

    // Ignora repetição do cabeçalho no meio da planilha.
    if (identificarCampo(textoDaCelula(linha, colunas.rm)) === "rm" && identificarCampo(textoDaCelula(linha, colunas.nome)) === "nome") {
      continue;
    }

    linhas.push(analisarLinha(linha, numero, colunas));
  }

  if (linhas.length === 0) {
    throw new Error(
      "Nenhuma linha de dados encontrada abaixo do cabeçalho. Verifique se a planilha possui as colunas RM, NOME e SOBRENOME preenchidas.",
    );
  }

  const avisos: string[] = [];
  if (aviso) avisos.push(aviso);
  if (grids.length > 1) {
    avisos.push(
      `Importamos os dados da aba "${grid.nome}". As outras abas do arquivo foram ignoradas.`,
    );
  }
  if (colunas.observacoes === null) {
    avisos.push(
      "A planilha não possui a coluna opcional OBSERVAÇÕES — os registros entrarão apenas com RM, nome e sobrenome.",
    );
  }

  return {
    aba: grid.nome,
    linhaCabecalho: linhaCabecalho + 1,
    colunas,
    linhas,
    totalLinhas: linhas.length,
    avisos,
  };
}
