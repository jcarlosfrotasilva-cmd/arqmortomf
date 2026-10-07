"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "@/lib/client/api";
import { ESCOLA } from "@/lib/escola";
import {
  IconArchive,
  IconClose,
  IconHistory,
  IconMenu,
  IconSearch,
  IconPrinter,
  IconShield,
  IconUpload,
} from "@/components/icons";
import { ToastProvider } from "@/components/toast";

const NAVEGACAO = [
  {
    href: "/",
    rotulo: "Consulta de prontuários",
    descricao: "Busca por nome e sobrenome",
    Icone: IconSearch,
  },
  {
    href: "/importar",
    rotulo: "Importar planilha",
    descricao: "Upload de arquivo Excel/CSV",
    Icone: IconUpload,
  },
  {
    href: "/importacoes",
    rotulo: "Histórico de importações",
    descricao: "Auditoria dos envios",
    Icone: IconHistory,
  },
  {
    href: "/imprimir",
    rotulo: "Impressão em papel",
    descricao: "Relação de prontuários em colunas",
    Icone: IconPrinter,
  },
  {
    href: "/backup",
    rotulo: "Backup e restauração",
    descricao: "Cópias de segurança do acervo",
    Icone: IconShield,
  },
];

function Marca({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm",
        compacto ? "p-2" : "p-3",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-200 via-teal-100 to-cyan-100 text-sm font-bold tracking-tight text-teal-900 shadow-lg shadow-teal-950/25">
        {ESCOLA.sigla}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-white">{ESCOLA.nome}</span>
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-100/80">
          {ESCOLA.cidade}
        </span>
      </span>
    </div>
  );
}

function Navegacao({ onNavegar }: { onNavegar?: () => void }) {
  const caminho = usePathname();

  return (
    <nav className="flex flex-col gap-1.5" aria-label="Navegação principal">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-100/60">
        {ESCOLA.sistema}
      </p>
      {NAVEGACAO.map((item) => {
        const ativo = caminho === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavegar}
            aria-current={ativo ? "page" : undefined}
            className={cx(
              "group relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
              ativo
                ? "bg-white/15 text-white ring-1 ring-inset ring-white/20 shadow-lg shadow-teal-950/20"
                : "text-teal-50/80 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            {ativo ? (
              <span
                aria-hidden
                className="absolute -left-0.5 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-emerald-200 to-cyan-200"
              />
            ) : null}
            <span
              className={cx(
                "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg transition",
                ativo
                  ? "bg-gradient-to-br from-emerald-200 to-cyan-100 text-teal-900"
                  : "bg-white/10 text-teal-100 group-hover:bg-white/15 group-hover:text-white",
              )}
            >
              <item.Icone className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{item.rotulo}</span>
              <span className={cx("block text-xs", ativo ? "text-teal-50/80" : "text-teal-100/60")}>
                {item.descricao}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function DicaConsulta() {
  return (
    <div className="rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-teal-50/90 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 font-semibold text-white">
        <IconSearch className="h-3.5 w-3.5" />
        Dica de consulta
      </p>
      <p className="mt-1.5">
        A busca localiza palavras que <strong className="font-semibold text-white">começam</strong>{" "}
        com o termo digitado: “Ana” encontra “Ana Clara”, mas não “Mariana”.
      </p>
    </div>
  );
}

export function AppShell({
  titulo,
  subtitulo,
  acoes,
  children,
}: {
  titulo: string;
  subtitulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = () => setMenuAberto(false);

  const fundoPainel =
    "relative overflow-hidden bg-gradient-to-b from-teal-700 via-teal-800 to-teal-950";

  const brilhos = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-cyan-200/15 blur-3xl"
      />
    </>
  );

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#f4f9f8]">
        <aside
          className={cx(
            "nao-imprimir hidden w-72 shrink-0 flex-col justify-between px-4 py-6 lg:flex",
            fundoPainel,
          )}
        >
          {brilhos}
          <div className="relative">
            <Marca />
            <div className="mt-7">
              <Navegacao />
            </div>
          </div>
          <div className="relative space-y-3">
            <DicaConsulta />
            <p className="px-1 text-[10px] leading-relaxed text-teal-100/60">
              {ESCOLA.identificacao} · {ESCOLA.responsavel}
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="nao-imprimir sticky top-0 z-30 lg:hidden">
            <div className={cx("px-4 py-3", fundoPainel)}>
              {brilhos}
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Marca compacto />
                </div>
                <button
                  type="button"
                  onClick={() => setMenuAberto((aberto) => !aberto)}
                  className="rounded-lg border border-white/25 p-2 text-white transition hover:bg-white/15"
                  aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
                  aria-expanded={menuAberto}
                >
                  {menuAberto ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {menuAberto ? (
              <div className={cx("animar-surgir px-4 py-4", fundoPainel)}>
                {brilhos}
                <div className="relative">
                  <Navegacao onNavegar={fecharMenu} />
                </div>
              </div>
            ) : null}
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-9">
            <div className="nao-imprimir mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                  <IconArchive className="h-3.5 w-3.5" />
                  {ESCOLA.identificacao}
                </p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  {titulo}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitulo}</p>
              </div>
              {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
            </div>
            {children}
          </main>

          <footer className="nao-imprimir border-t border-teal-100 bg-white/70 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
            <span className="font-semibold text-teal-800">{ESCOLA.identificacao}</span> ·{" "}
            {ESCOLA.sistema} escolar · dados armazenados em PostgreSQL
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}
