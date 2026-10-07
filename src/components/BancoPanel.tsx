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

/** Orientações de contingência para queda de energia ou de internet. */
export function PainelContingencia() {
  const itens = [
    {
      titulo: "Faltou energia ou internet na escola",
      texto:
        "O sistema continua salvo no servidor: nada se perde. Ao voltar a conexão, recarregue a página e os dados estarão exatamente como estavam. Enquanto isso, o aparelho mostra a última consulta que ficou guardada.",
    },
    {
      titulo: "Use pelo celular ou tablet",
      texto:
        "O sistema é responsivo (cartões no celular, tabela no computador) e pode ser instalado como aplicativo: no Android use “Instalar aplicativo”; no iPhone use Compartilhar → “Adicionar à Tela de Início”.",
    },
    {
      titulo: "Rotina de segurança recomendada",
      texto:
        "Uma vez por semana gere uma cópia em “Guardar cópia no sistema” e baixe o .json no computador da secretaria. Guarde também uma versão impressa (ou PDF) da relação completa.",
    },
    {
      titulo: "Para trabalhar sem internet nenhuma",
      texto:
        "O sistema pode rodar em um computador da escola com PostgreSQL local. Nesse caso ele funciona na rede interna (mesmo sem internet), e a cópia .json serve para transferir os dados quando houver conexão.",
    },
  ];

  return (
    <Cartao className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Se faltar energia ou internet (plano de contingência)
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Como o arquivo morto continua protegido e o que fazer na volta da conexão.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {itens.map((item) => (
          <div
            key={item.titulo}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
          >
            <p className="text-xs font-semibold text-teal-800">{item.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.texto}</p>
          </div>
        ))}
      </div>
    </Cartao>
  );
}
