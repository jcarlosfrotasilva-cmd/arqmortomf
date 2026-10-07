"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cx } from "@/lib/client/api";
import { IconAlert, IconCheck } from "@/components/icons";

function inscreverOnline(retorno: () => void) {
  window.addEventListener("online", retorno);
  window.addEventListener("offline", retorno);
  return () => {
    window.removeEventListener("online", retorno);
    window.removeEventListener("offline", retorno);
  };
}

/** Estado da conexão (sem setState em efeito — usa useSyncExternalStore). */
function useOnline(): boolean {
  return useSyncExternalStore(
    inscreverOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Registra o service worker (app instalável no celular/tablet, com cache das
 * últimas consultas) e mostra um aviso discreto quando a internet cai.
 */
export function ServicoApp() {
  const online = useOnline();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return undefined;
    }

    const registrar = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((erro) => console.warn("[sw] não foi possível registrar:", erro));
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => window.removeEventListener("load", registrar);
  }, []);

  if (online) return null;

  return (
    <div className="nao-imprimir sticky top-0 z-40 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-sm">
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <IconAlert className="h-4 w-4" />
        <span>
          Sem conexão com a internet — o sistema está mostrando a última consulta salva no aparelho.
        </span>
        <span className="hidden items-center gap-1 rounded bg-amber-950/10 px-1.5 py-0.5 sm:inline-flex">
          <IconCheck className="h-3.5 w-3.5" />
          nada foi perdido: tudo continua salvo no servidor
        </span>
      </span>
    </div>
  );
}

/** Selo usado nas telas quando o conteúdo exibido veio do cache do aparelho. */
export function SeloOffline({ salvoEm, className }: { salvoEm?: string | null; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200",
        className,
      )}
    >
      <IconAlert className="h-3.5 w-3.5" />
      Dados salvos no aparelho{salvoEm ? ` em ${salvoEm}` : ""} (modo offline)
    </span>
  );
}
