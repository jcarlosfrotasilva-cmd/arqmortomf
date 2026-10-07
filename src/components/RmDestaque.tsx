import { cx } from "@/lib/client/api";

type Variante = "tabela" | "cartao" | "compacto" | "texto";

const ESTILOS: Record<Variante, string> = {
  // Tabela do computador/tablet: negrito e fonte maior, com pílula de destaque.
  tabela:
    "inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 font-mono text-base font-bold tabular-nums tracking-tight text-teal-900 ring-1 ring-inset ring-teal-200",
  // Cartão do celular: ainda mais evidente.
  cartao:
    "inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 font-mono text-base font-bold tabular-nums tracking-tight text-teal-900 ring-1 ring-inset ring-teal-200",
  // Listas compactas (prévias de importação/restauração).
  compacto:
    "inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-teal-900 ring-1 ring-inset ring-teal-200",
  // Dentro de textos corridos (avisos, confirmações).
  texto: "font-mono text-sm font-bold text-teal-900",
};

/**
 * RM em destaque: negrito, fonte maior e monoespaçada (números não dançam na
 * leitura), com fundo suave para o operador localizar o registro rapidamente.
 */
export function RmDestaque({
  rm,
  variante = "tabela",
  rotulo = true,
  className,
}: {
  rm: string;
  variante?: Variante;
  /** Exibe o prefixo "RM" (útil onde o cabeçalho da coluna não deixa claro). */
  rotulo?: boolean;
  className?: string;
}) {
  if (variante === "texto") {
    return (
      <span className={cx(ESTILOS.texto, className)}>
        {rotulo ? "RM " : ""}
        {rm}
      </span>
    );
  }

  return (
    <span className={cx(ESTILOS[variante], className)} title={`RM ${rm}`}>
      {rotulo ? (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
          RM
        </span>
      ) : null}
      {rm}
    </span>
  );
}
