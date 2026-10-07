"use client";

import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cx } from "@/lib/client/api";
import { IconClose, IconSpinner } from "@/components/icons";

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo" | "fantasma";
  carregando?: boolean;
  icone?: ReactNode;
};

const VARIANTES: Record<NonNullable<BotaoProps["variante"]>, string> = {
  primario:
    "bg-teal-700 text-white shadow-sm shadow-teal-700/25 hover:bg-teal-800 focus-visible:outline-teal-700 disabled:bg-teal-300",
  secundario:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-slate-400 disabled:text-slate-400",
  perigo:
    "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-300",
  fantasma:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400 disabled:text-slate-300",
};

export function Botao({
  variante = "secundario",
  carregando = false,
  icone,
  className,
  children,
  disabled,
  ...props
}: BotaoProps) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? <IconSpinner className="h-4 w-4" /> : icone}
      {children}
    </button>
  );
}

export function Cartao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Etiqueta({
  children,
  tom = "slate",
  className,
}: {
  children: ReactNode;
  tom?: "slate" | "teal" | "emerald" | "amber" | "rose";
  className?: string;
}) {
  const tons = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    teal: "bg-teal-50 text-teal-700 ring-teal-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Rotulo({
  children,
  obrigatorio,
  htmlFor,
}: {
  children: ReactNode;
  obrigatorio?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {obrigatorio ? <span className="ml-0.5 text-rose-600">*</span> : null}
    </label>
  );
}

const BASE_CAMPO =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline focus:outline-2 focus:outline-offset-0 disabled:bg-slate-50";

export function CampoTexto({
  erro,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { erro?: string }) {
  return (
    <div>
      <input
        {...props}
        className={cx(
          BASE_CAMPO,
          erro
            ? "border-rose-400 focus:outline-rose-500"
            : "border-slate-300 focus:border-teal-500 focus:outline-teal-500",
          className,
        )}
        aria-invalid={erro ? true : undefined}
      />
      {erro ? <p className="mt-1 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}

export function CampoSelect({
  erro,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { erro?: string }) {
  return (
    <div>
      <select
        {...props}
        className={cx(
          BASE_CAMPO,
          "cursor-pointer pr-8",
          erro
            ? "border-rose-400 focus:outline-rose-500"
            : "border-slate-300 focus:border-teal-500 focus:outline-teal-500",
          className,
        )}
      >
        {children}
      </select>
      {erro ? <p className="mt-1 text-xs font-medium text-rose-600">{erro}</p> : null}
    </div>
  );
}

export function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  children,
  rodape,
  largura = "max-w-2xl",
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return undefined;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cx(
          "animar-surgir my-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
          largura,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            {descricao ? <p className="mt-0.5 text-sm text-slate-500">{descricao}</p> : null}
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {rodape ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            {rodape}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icone}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{titulo}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{descricao}</p>
      </div>
      {acao}
    </div>
  );
}
