"use client";

import { ALFABETO, type CampoIndice, type LetraIndice } from "@/lib/types";
import { cx } from "@/lib/client/api";

function BotaoLetra({
  letra,
  total,
  ativo,
  compacto,
  onSelecionar,
}: {
  letra: string;
  total: number;
  ativo: boolean;
  compacto: boolean;
  onSelecionar: (letra: string) => void;
}) {
  const vazio = total === 0;

  return (
    <button
      type="button"
      disabled={vazio}
      aria-pressed={ativo}
      title={
        vazio
          ? `Nenhum prontuário começando com ${letra}`
          : `${total} prontuário(s) começando com ${letra}`
      }
      onClick={() => onSelecionar(letra)}
      className={cx(
        "flex flex-col items-center justify-center rounded-lg border font-bold uppercase transition",
        compacto ? "h-8 w-8 text-[11px]" : "h-11 w-full text-sm",
        ativo
          ? "border-teal-700 bg-teal-700 text-white shadow-sm shadow-teal-700/25"
          : vazio
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
            : "border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800",
      )}
    >
      <span>{letra}</span>
      {!compacto ? (
        <span
          className={cx(
            "text-[9px] font-semibold leading-none",
            ativo ? "text-teal-100" : vazio ? "text-slate-300" : "text-slate-400",
          )}
        >
          {vazio ? "–" : total}
        </span>
      ) : null}
    </button>
  );
}

export function IndiceAlfabetico({
  letras,
  letraAtiva,
  campo,
  onCampoChange,
  onSelecionar,
  carregando = false,
  compacto = false,
  totalFiltrado,
  className,
}: {
  letras: LetraIndice[];
  letraAtiva: string;
  campo: CampoIndice;
  onCampoChange: (campo: CampoIndice) => void;
  onSelecionar: (letra: string | null) => void;
  carregando?: boolean;
  compacto?: boolean;
  totalFiltrado?: number;
  className?: string;
}) {
  const mapa = new Map(letras.map((item) => [item.letra.toUpperCase(), item.total]));
  const totalOutros = mapa.get("#") ?? 0;
  const totalAtivo = letraAtiva ? (mapa.get(letraAtiva.toUpperCase()) ?? 0) : 0;
  const letraCheia = Boolean(letraAtiva) && totalAtivo >= 150;

  return (
    <section
      aria-label="Índice alfabético"
      className={cx(
        "rounded-xl border border-slate-200 bg-slate-50/70 p-3",
        carregando && "opacity-60",
        className,
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            Localizar pela letra inicial
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
            {(
              [
                { valor: "sobrenome" as CampoIndice, rotulo: "Sobrenome" },
                { valor: "nome" as CampoIndice, rotulo: "Nome" },
              ]
            ).map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => onCampoChange(opcao.valor)}
                aria-pressed={campo === opcao.valor}
                className={cx(
                  "px-2.5 py-1 text-xs font-semibold transition",
                  campo === opcao.valor
                    ? "bg-teal-700 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalFiltrado !== undefined ? (
            <span className="text-xs text-slate-500">
              {totalFiltrado} registro(s) {letraAtiva ? `começando com ${letraAtiva}` : "no total"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onSelecionar(null)}
            disabled={!letraAtiva}
            className={cx(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
              letraAtiva
                ? "border-teal-300 bg-white text-teal-800 hover:bg-teal-50"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
            )}
          >
            Todos os registros
          </button>
        </div>
      </div>

      {letraCheia ? (
        <p className="mb-2 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[11px] leading-snug text-teal-900 ring-1 ring-inset ring-teal-200">
          A letra <strong>{letraAtiva}</strong> reúne <strong>{totalAtivo}</strong> registros. Para
          chegar direto ao prontuário, digite também o restante do{" "}
          {campo === "nome" ? "nome" : "sobrenome"} na busca — por exemplo “{letraAtiva.toLowerCase()}
          silva” localiza apenas quem começa assim.
        </p>
      ) : null}

      <div
        className={cx(
          compacto
            ? "flex flex-wrap gap-1"
            : "grid grid-cols-7 gap-1.5 sm:grid-cols-10 lg:grid-cols-13 xl:grid-cols-14",
        )}
      >
        {ALFABETO.map((letra) => (
          <BotaoLetra
            key={letra}
            letra={letra}
            total={mapa.get(letra) ?? 0}
            ativo={letraAtiva === letra}
            compacto={compacto}
            onSelecionar={(selecionada) =>
              onSelecionar(selecionada === letraAtiva ? null : selecionada)
            }
          />
        ))}

        {totalOutros > 0 ? (
          <div className={cx(compacto ? "flex gap-1" : "col-span-7 mt-1 sm:col-span-10")}>
            <div className={cx("flex items-center gap-2", compacto ? "flex-row" : "flex-row")}>
              <button
                type="button"
                aria-pressed={letraAtiva === "#"}
                title={`${totalOutros} registro(s) com inicial numérica ou símbolo — revise estes cadastros`}
                onClick={() => onSelecionar(letraAtiva === "#" ? null : "#")}
                className={cx(
                  "flex flex-col items-center justify-center rounded-lg border font-bold transition",
                  compacto ? "h-8 w-12 text-[11px]" : "h-11 w-16 text-sm",
                  letraAtiva === "#"
                    ? "border-amber-600 bg-amber-600 text-white shadow-sm shadow-amber-600/25"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400 hover:bg-amber-100",
                )}
              >
                <span>#</span>
                {!compacto ? (
                  <span className="text-[9px] font-semibold leading-none text-amber-700/80">
                    {totalOutros}
                  </span>
                ) : null}
              </button>
              <span className={cx("text-[10px] leading-tight text-amber-800", compacto && "max-w-24")}>
                números ou símbolos (revisar cadastro)
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
