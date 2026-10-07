"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/client/api";
import { IconAlert, IconCheck, IconClose } from "@/components/icons";

type TipoToast = "sucesso" | "erro" | "info";

type Toast = {
  id: number;
  tipo: TipoToast;
  titulo: string;
  descricao?: string;
};

type ContextoToast = {
  notificar: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ContextoToast | null>(null);

const ESTILOS: Record<TipoToast, { borda: string; icone: string; Icone: typeof IconCheck }> = {
  sucesso: { borda: "border-l-emerald-500", icone: "text-emerald-600", Icone: IconCheck },
  erro: { borda: "border-l-rose-500", icone: "text-rose-600", Icone: IconAlert },
  info: { borda: "border-l-teal-500", icone: "text-teal-600", Icone: IconAlert },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.filter((toast) => toast.id !== id));
  }, []);

  const notificar = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((atual) => [...atual.slice(-3), { ...toast, id }]);
      window.setTimeout(() => remover(id), 6000);
    },
    [remover],
  );

  const valor = useMemo(() => ({ notificar }), [notificar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const estilo = ESTILOS[toast.tipo];
          return (
            <div
              key={toast.id}
              role="status"
              className={cx(
                "animar-surgir pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 border-l-4 bg-white p-3.5 shadow-lg shadow-slate-900/5",
                estilo.borda,
              )}
            >
              <estilo.Icone className={cx("mt-0.5 h-5 w-5", estilo.icone)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{toast.titulo}</p>
                {toast.descricao ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.descricao}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remover(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar notificação"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ContextoToast {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error("useToast deve ser usado dentro de ToastProvider");
  }
  return contexto;
}
