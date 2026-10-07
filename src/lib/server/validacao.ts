import { z } from "zod";
import { formatRm, normalizeText, toTitleCase } from "@/lib/text";

const textoObrigatorio = (max: number, campo: string) =>
  z
    .string({ error: `${campo} é obrigatório.` })
    .transform((valor) => valor.trim())
    .refine((valor) => valor.length > 0, `${campo} é obrigatório.`)
    .refine((valor) => valor.length <= max, `${campo} deve ter no máximo ${max} caracteres.`);

const textoOpcional = (max: number) =>
  z.preprocess(
    (valor) => {
      if (valor === null || valor === undefined) return null;
      const texto = String(valor).trim();
      if (texto.length === 0) return null;
      return texto.length > max ? texto.slice(0, max) : texto;
    },
    z.string().max(max).nullable(),
  );

export const prontuarioSchema = z.object({
  rm: textoObrigatorio(30, "RM").transform((valor) => formatRm(valor)),
  nome: textoObrigatorio(120, "Nome").transform((valor) => toTitleCase(valor)),
  sobrenome: textoObrigatorio(160, "Sobrenome").transform((valor) => toTitleCase(valor)),
  observacoes: textoOpcional(1000),
});

export type EntradaProntuario = z.infer<typeof prontuarioSchema>;

export const dadosParaBanco = (dados: EntradaProntuario) => ({
  rm: dados.rm,
  nome: dados.nome,
  sobrenome: dados.sobrenome,
  nomeBusca: normalizeText(dados.nome),
  sobrenomeBusca: normalizeText(dados.sobrenome),
  observacoes: dados.observacoes,
});

export type ValidacaoOk = { ok: true; dados: EntradaProntuario };
export type ValidacaoErro = { ok: false; erros: Record<string, string> };

export function validarProntuario(entrada: unknown): ValidacaoOk | ValidacaoErro {
  const resultado = prontuarioSchema.safeParse(entrada);

  if (!resultado.success) {
    const erros: Record<string, string> = {};
    for (const issue of resultado.error.issues) {
      const chave = String(issue.path[0] ?? "form");
      if (!erros[chave]) erros[chave] = issue.message;
    }
    return { ok: false, erros };
  }

  return { ok: true, dados: resultado.data };
}

export function validarIds(entrada: unknown): number[] | null {
  if (!Array.isArray(entrada)) return null;
  const ids = entrada
    .map((valor) => Number.parseInt(String(valor), 10))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
  if (ids.length === 0) return null;
  return Array.from(new Set(ids)).slice(0, 500);
}
