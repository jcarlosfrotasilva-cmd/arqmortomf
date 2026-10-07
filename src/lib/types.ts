export type Prontuario = {
  id: number;
  rm: string;
  nome: string;
  sobrenome: string;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Ordenacao = "sobrenome" | "nome" | "rm" | "recentes";

/** Campo usado pelo índice alfabético. */
export type CampoIndice = "nome" | "sobrenome";

export type LetraIndice = { letra: string; total: number };

export type FiltrosBusca = {
  nome: string;
  sobrenome: string;
  rm: string;
  letra: string;
  campoLetra: CampoIndice;
  ordenarPor: Ordenacao;
  direcao: "asc" | "desc";
  pagina: number;
  tamanhoPagina: number;
};

export type ConsultaChave = {
  nome: string;
  sobrenome: string;
  rm: string;
};

export const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const TAMANHOS_PAGINA_CLIENTE: number[] = [10, 25, 50, 100];

export type ListaProntuarios = {
  itens: Prontuario[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
};

export type Estatisticas = {
  total: number;
  totalSobrenomes: number;
  totalUltimosSeteDias: number;
  ultimaImportacao: {
    arquivo: string;
    inseridos: number;
    atualizados: number;
    ignorados: number;
    createdAt: string;
  } | null;
};

export type LinhaPrevia = {
  linha: number;
  rm: string;
  nome: string;
  sobrenome: string;
  situacao: "novo" | "atualizacao";
};

export type ResultadoImportacao = {
  arquivo: string;
  totalLinhas: number;
  linhasValidas: number;
  novos: number;
  atualizados: number;
  ignorados: number;
  previa: LinhaPrevia[];
  erros: { linha: number; mensagem: string }[];
  confirmada: boolean;
  importacaoId: number | null;
};

export type ResultadoRestauracao = {
  arquivo: string;
  formato: "backup-json" | "planilha";
  modo: "mesclar" | "substituir";
  totalLinhas: number;
  linhasValidas: number;
  novos: number;
  atualizados: number;
  ignorados: number;
  previa: LinhaPrevia[];
  erros: { linha: number; mensagem: string }[];
  avisos: string[];
  confirmada: boolean;
  importacaoId: number | null;
};

export type BackupSalvo = {
  id: number;
  nome: string;
  tamanhoBytes: number;
  totalRegistros: number;
  createdAt: string;
};

export type RegistroImportacao = {
  id: number;
  arquivo: string;
  modo: string;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: { linha: number; mensagem: string }[];
  createdAt: string;
};
