import { Cartao, Etiqueta } from "@/components/ui";
import { IconShield } from "@/components/icons";

export type InfoBanco = {
  host: string;
  porta: string;
  ssl: boolean;
  versao: string;
  estruturaCriada: boolean;
  prontuarios: number | null;
  latenciaMs: number;
};

function Linha({ rotulo, valor, tom = "slate" }: { rotulo: string; valor: string; tom?: "slate" | "teal" | "emerald" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span className="min-w-0 truncate text-xs font-semibold text-slate-800" title={valor}>
        <Etiqueta tom={tom}>{valor}</Etiqueta>
      </span>
    </div>
  );
}

/** Diagnóstico da conexão com o banco (local, Supabase, Neon…) e do schema. */
export function BancoPanel({ info }: { info: InfoBanco }) {
  const gerenciado = !/^(localhost|127\.0\.0\.1|::1)$/i.test(info.host);

  return (
    <Cartao className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={
            info.estruturaCriada
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"
          }
        >
          <IconShield className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Banco de dados conectado</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {info.estruturaCriada
              ? `Tudo certo: ${info.prontuarios ?? 0} prontuário(s) disponíveis.`
              : "Conexão estabelecida, mas as tabelas ainda não foram criadas neste banco."}
          </p>

          <div className="mt-3 grid gap-x-6 gap-y-0 sm:grid-cols-2">
            <div>
              <Linha rotulo="Servidor" valor={info.host} />
              <Linha rotulo="Porta" valor={info.porta} tom={info.porta === "6543" ? "teal" : "slate"} />
              <Linha
                rotulo="SSL"
                valor={info.ssl ? "habilitado" : "desabilitado"}
                tom={info.ssl ? "emerald" : "slate"}
              />
            </div>
            <div>
              <Linha rotulo="PostgreSQL" valor={info.versao} />
              <Linha
                rotulo="Ambiente"
                valor={gerenciado ? "nuvem (Supabase/Neon)" : "local"}
                tom={gerenciado ? "teal" : "slate"}
              />
              <Linha rotulo="Latência" valor={`${info.latenciaMs} ms`} />
            </div>
          </div>

          {!info.estruturaCriada ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
              Para criar as tabelas neste banco rode, na raiz do projeto:{" "}
              <span className="font-mono">DATABASE_URL=&quot;…&quot; node scripts/setup-supabase.mjs</span>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-900 ring-1 ring-inset ring-teal-200">
              {gerenciado
                ? "Conectado a um PostgreSQL gerenciado. Em produção use a porta 6543 (pooler) para evitar estouro de conexões."
                : "Estrutura local detectada. Ao publicar, basta trocar DATABASE_URL para o Supabase — nenhum código precisa mudar."}
            </p>
          )}
        </div>
      </div>
    </Cartao>
  );
}
