/**
 * Normalização de texto usada tanto na gravação (colunas `nome_busca`,
 * `sobrenome_busca`) quanto na consulta, garantindo busca sem acento e
 * insensível a maiúsculas/minúsculas.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide um termo de busca em palavras normalizadas (busca "todas as palavras"). */
export function searchWords(value: string | null | undefined): string[] {
  if (!value) return [];
  return normalizeText(value).split(" ").filter(Boolean);
}

/** Converte "MARIA DA SILVA" em "Maria da Silva" (mantém conectivos minúsculos). */
const CONECTIVOS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "du",
  "van",
  "von",
  "dos",
  "la",
  "le",
]);

export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index > 0 && CONECTIVOS.has(word)) return word;
      if (word.length <= 2 && index > 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Padroniza o RM: maiúsculo, sem espaços, apenas letras/números/.-/ */
export function formatRm(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9./-]/g, "")
    .slice(0, 30);
}

export function initials(nome: string, sobrenome: string): string {
  const a = nome.trim().charAt(0);
  const b = sobrenome.trim().split(/\s+/)[0]?.charAt(0) ?? "";
  return `${a}${b}`.toUpperCase();
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
