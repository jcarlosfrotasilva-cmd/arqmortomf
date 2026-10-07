"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cx, filtrosParaQueryString, requisitar } from "@/lib/client/api";
import { Botao, CampoSelect, CampoTexto, Cartao, Etiqueta, Rotulo } from "@/components/ui";
import { useToast } from "@/components/toast";
import { IndiceAlfabetico } from "@/components/IndiceAlfabetico";
import { IconAlert, IconPrinter, IconSearch, IconSpinner } from "@/components/icons";
import { ESCOLA } from "@/lib/escola";
import { formatDateTime } from "@/lib/text";
import type { CampoIndice, LetraIndice, Ordenacao, Prontuario } from "@/lib/types";

type RespostaRelatorio = {
  itens: Prontuario[];
  total: number;
  geradoEm: string;
  filtros: { nome: string; sobrenome: string; rm: string; ordenarPor: Ordenacao; direcao: string };
};

const LINHAS_OPCOES = [28, 32, 36, 40, 44, 48];
const COLUNAS_OPCOES = [1, 2, 3, 4];

const TAMANHOS = {
  compacta: { registro: "9px", rm: "7.5px", titulo: "11px", meta: "8px", linha: "15px" },
  normal: { registro: "10px", rm: "8px", titulo: "12px", meta: "8.5px", linha: "17px" },
  ampliada: { registro: "11.5px", rm: "9px", titulo: "13px", meta: "9.5px", linha: "20px" },
} as const;

type TamanhoFonte = keyof typeof TAMANHOS;

function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}

function descricaoFiltros(filtros: {
  nome: string;
  sobrenome: string;
  rm: string;
  letra: string;
  campoLetra: CampoIndice;
  ordenarPor: Ordenacao;
}): string {
  const partes: string[] = [];
  if (filtros.letra) {
    partes.push(
      `${filtros.campoLetra === "nome" ? "nome" : "sobrenome"} começando com a letra ${filtros.letra}`,
    );
  }
  if (filtros.nome) partes.push(`nome começando com “${filtros.nome}”`);
  if (filtros.sobrenome) partes.push(`sobrenome começando com “${filtros.sobrenome}”`);
  if (filtros.rm) partes.push(`RM contendo “${filtros.rm}”`);

  const rotulos: Record<Ordenacao, string> = {
    sobrenome: "sobrenome",
    nome: "nome",
    rm: "RM",
    recentes: "cadastro recente",
  };

  const base = partes.length > 0 ? `Filtros: ${partes.join(" e ")}` : "Sem filtros: acervo completo";
  return `${base} · ordenado por ${rotulos[filtros.ordenarPor]}`;
}

export function ImpressaoView({
  filtrosIniciais,
}: {
  filtrosIniciais: { nome: string; sobrenome: string; rm: string; letra: string; campoLetra: CampoIndice };
}) {
  const { notificar } = useToast();
  const [nome, setNome] = useState(filtrosIniciais.nome);
  const [sobrenome, setSobrenome] = useState(filtrosIniciais.sobrenome);
  const [rm, setRm] = useState(filtrosIniciais.rm);
  const [letra, setLetra] = useState(filtrosIniciais.letra);
  const [campoLetra, setCampoLetra] = useState<CampoIndice>(filtrosIniciais.campoLetra);
  const [indiceResposta, setIndiceResposta] = useState<{ chave: string; letras: LetraIndice[] } | null>(null);
  const [ordenarPor, setOrdenarPor] = useState<Ordenacao>("sobrenome");
  const [colunas, setColunas] = useState(3);
  const [linhasPorColuna, setLinhasPorColuna] = useState(36);
  const [ordem, setOrdem] = useState<"coluna" | "linha">("coluna");
  const [orientacao, setOrientacao] = useState<"portrait" | "landscape">("portrait");
  const [tamanhoFonte, setTamanhoFonte] = useState<TamanhoFonte>("compacta");
  const [mostrarObservacoes, setMostrarObservacoes] = useState(false);
  const [mostrarRm, setMostrarRm] = useState(true);
  const [dados, setDados] = useState<RespostaRelatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const consulta = useMemo(
    () => filtrosParaQueryString({ nome, sobrenome, rm, letra, campoLetra, ordenarPor, direcao: "asc" }),
    [nome, sobrenome, rm, letra, campoLetra, ordenarPor],
  );

  const chaveIndice = useMemo(
    () => filtrosParaQueryString({ campo: campoLetra, nome, sobrenome, rm }),
    [campoLetra, nome, sobrenome, rm],
  );

  useEffect(() => {
    const controlador = new AbortController();
    requisitar<{ letras: LetraIndice[] }>(`/api/prontuarios/indice?${chaveIndice}`, {
      signal: controlador.signal,
    })
      .then((resposta) => setIndiceResposta({ chave: chaveIndice, letras: resposta.letras }))
      .catch(() => setIndiceResposta({ chave: chaveIndice, letras: [] }));

    return () => controlador.abort();
  }, [chaveIndice]);

  const indice = indiceResposta?.letras ?? [];
  const carregandoIndice = indiceResposta?.chave !== chaveIndice;

  useEffect(() => {
    const controlador = new AbortController();
    requisitar<RespostaRelatorio>(`/api/prontuarios/relatorio?${consulta}`, {
      signal: controlador.signal,
    })
      .then((resposta) => {
        setDados(resposta);
        setErro(null);
      })
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === "AbortError") return;
        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a relação.");
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(false);
      });

    return () => controlador.abort();
  }, [consulta]);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const porPagina = colunas * linhasPorColuna;
  const blocos = useMemo(() => emBlocos(itens, porPagina), [itens, porPagina]);
  const estilo = TAMANHOS[tamanhoFonte];

  const imprimir = useCallback(() => {
    if (itens.length === 0) {
      notificar({
        tipo: "info",
        titulo: "Nada para imprimir",
        descricao: "A relação está vazia. Ajuste os filtros ou importe a planilha do acervo.",
      });
      return;
    }
    window.print();
  }, [itens.length, notificar]);

  return (
    <div className="space-y-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: A4 ${orientacao}; margin: 10mm 10mm 12mm 10mm; }`,
        }}
      />

      <Cartao className="nao-imprimir p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Configurar a impressão</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Escolha quantas <strong>colunas</strong> deseja no papel e como os registros devem
              preencher a página. A pré-visualização abaixo mostra exatamente o que será impresso.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar à consulta
            </Link>
            <Botao
              type="button"
              variante="primario"
              icone={<IconPrinter className="h-4 w-4" />}
              onClick={imprimir}
              disabled={carregando}
            >
              Imprimir / Salvar em PDF
            </Botao>
          </div>
        </div>

        <div className="mt-4">
          <IndiceAlfabetico
            compacto
            letras={indice}
            letraAtiva={letra}
            campo={campoLetra}
            carregando={carregandoIndice}
            totalFiltrado={itens.length}
            onCampoChange={(campo) => {
              setCampoLetra(campo);
              setLetra("");
            }}
            onSelecionar={(selecionada) => setLetra(selecionada ?? "")}
          />
        </div>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            imprimir();
          }}
        >
          <div>
            <Rotulo htmlFor="imp-nome">Nome</Rotulo>
            <CampoTexto
              id="imp-nome"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Todos"
              autoComplete="off"
            />
          </div>
          <div>
            <Rotulo htmlFor="imp-sobrenome">Sobrenome</Rotulo>
            <CampoTexto
              id="imp-sobrenome"
              value={sobrenome}
              onChange={(evento) => setSobrenome(evento.target.value)}
              placeholder="Todos"
              autoComplete="off"
            />
          </div>
          <div>
            <Rotulo htmlFor="imp-rm">RM</Rotulo>
            <CampoTexto
              id="imp-rm"
              value={rm}
              onChange={(evento) => setRm(evento.target.value)}
              placeholder="Todos"
              autoComplete="off"
            />
          </div>
          <div>
            <Rotulo htmlFor="imp-ordem-listagem">Ordenar por</Rotulo>
            <CampoSelect
              id="imp-ordem-listagem"
              value={ordenarPor}
              onChange={(evento) => setOrdenarPor(evento.target.value as Ordenacao)}
            >
              <option value="sobrenome">Sobrenome</option>
              <option value="nome">Nome</option>
              <option value="rm">RM</option>
              <option value="recentes">Cadastro recente</option>
            </CampoSelect>
          </div>
        </form>

        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <Rotulo htmlFor="imp-colunas">Colunas na folha</Rotulo>
            <CampoSelect
              id="imp-colunas"
              value={colunas}
              onChange={(evento) => setColunas(Number(evento.target.value))}
            >
              {COLUNAS_OPCOES.map((quantidade) => (
                <option key={quantidade} value={quantidade}>
                  {quantidade} coluna{quantidade > 1 ? "s" : ""}
                </option>
              ))}
            </CampoSelect>
          </div>
          <div>
            <Rotulo htmlFor="imp-linhas">Linhas por coluna</Rotulo>
            <CampoSelect
              id="imp-linhas"
              value={linhasPorColuna}
              onChange={(evento) => setLinhasPorColuna(Number(evento.target.value))}
            >
              {LINHAS_OPCOES.map((quantidade) => (
                <option key={quantidade} value={quantidade}>
                  {quantidade} linhas
                </option>
              ))}
            </CampoSelect>
          </div>
          <div>
            <Rotulo htmlFor="imp-preenchimento">Preenchimento</Rotulo>
            <CampoSelect
              id="imp-preenchimento"
              value={ordem}
              onChange={(evento) => setOrdem(evento.target.value as "coluna" | "linha")}
            >
              <option value="coluna">Coluna por coluna (lista telefônica)</option>
              <option value="linha">Linha por linha (leitura horizontal)</option>
            </CampoSelect>
          </div>
          <div>
            <Rotulo htmlFor="imp-orientacao">Papel</Rotulo>
            <CampoSelect
              id="imp-orientacao"
              value={orientacao}
              onChange={(evento) => setOrientacao(evento.target.value as "portrait" | "landscape")}
            >
              <option value="portrait">A4 retrato</option>
              <option value="landscape">A4 paisagem</option>
            </CampoSelect>
          </div>
          <div>
            <Rotulo htmlFor="imp-fonte">Tamanho da letra</Rotulo>
            <CampoSelect
              id="imp-fonte"
              value={tamanhoFonte}
              onChange={(evento) => setTamanhoFonte(evento.target.value as TamanhoFonte)}
            >
              <option value="compacta">Compacta</option>
              <option value="normal">Normal</option>
              <option value="ampliada">Ampliada</option>
            </CampoSelect>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mostrarRm}
              onChange={(evento) => setMostrarRm(evento.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-700"
            />
            Exibir o RM em cada registro
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mostrarObservacoes}
              onChange={(evento) => setMostrarObservacoes(evento.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-700"
            />
            Exibir observações (pode reduzir o número de registros por folha)
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3">
          <Etiqueta tom="teal">{itens.length} registro(s)</Etiqueta>
          <Etiqueta tom="slate">
            {porPagina} por folha ({colunas} × {linhasPorColuna})
          </Etiqueta>
          <Etiqueta tom="teal">{blocos.length || 0} folha(s) estimada(s)</Etiqueta>
          {dados ? (
            <span className="text-xs text-slate-500">
              Relação gerada em {formatDateTime(dados.geradoEm)}
            </span>
          ) : null}
        </div>
      </Cartao>

      {erro ? (
        <Cartao className="nao-imprimir p-5">
          <div className="flex items-center gap-2 text-sm text-rose-700">
            <IconAlert className="h-4 w-4" />
            {erro}
          </div>
        </Cartao>
      ) : null}

      {carregando && !dados ? (
        <Cartao className="nao-imprimir flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
          <IconSpinner /> Montando a relação para impressão...
        </Cartao>
      ) : null}

      {!carregando && itens.length === 0 ? (
        <Cartao className="nao-imprimir p-10 text-center">
          <IconSearch className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Nenhum registro encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Ajuste os filtros de nome, sobrenome ou RM para montar a relação que deseja imprimir.
          </p>
        </Cartao>
      ) : null}

      {itens.length > 0 ? (
        <div className="space-y-6">
          <p className="nao-imprimir text-xs font-medium uppercase tracking-wide text-slate-500">
            Pré-visualização ({blocos.length} folha{blocos.length > 1 ? "s" : ""})
          </p>

          {blocos.map((bloco, indice) => (
            <section
              key={`bloco-${indice}`}
              className="bloco-impressao area-impressao rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-teal-800 pb-2">
                <div>
                  <p
                    className="font-bold uppercase tracking-wide text-teal-900"
                    style={{ fontSize: estilo.titulo }}
                  >
                    {ESCOLA.identificacao}
                  </p>
                  <p className="font-semibold text-slate-800" style={{ fontSize: estilo.meta }}>
                    RELAÇÃO DE PRONTUÁRIOS DO ARQUIVO MORTO
                  </p>
                  <p className="text-slate-500" style={{ fontSize: estilo.meta }}>
                    {descricaoFiltros({
                      nome: dados?.filtros.nome ?? nome,
                      sobrenome: dados?.filtros.sobrenome ?? sobrenome,
                      rm: dados?.filtros.rm ?? rm,
                      letra,
                      campoLetra,
                      ordenarPor,
                    })}
                  </p>
                </div>
                <div className="text-right text-slate-500" style={{ fontSize: estilo.meta }}>
                  <p>
                    Folha {indice + 1} de {blocos.length}
                  </p>
                  <p>
                    Registros {indice * porPagina + 1}–
                    {Math.min((indice + 1) * porPagina, itens.length)} de {itens.length}
                  </p>
                  <p>Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </header>

              <div
                className="mt-2 grid gap-x-4"
                style={{
                  gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`,
                  ...(ordem === "coluna"
                    ? {
                        gridAutoFlow: "column" as const,
                        gridTemplateRows: `repeat(${linhasPorColuna}, minmax(0, ${estilo.linha}))`,
                      }
                    : {}),
                }}
              >
                {bloco.map((item) => (
                  <div
                    key={item.id}
                    className={cx(
                      "registro-impressao flex items-baseline gap-2 overflow-hidden border-b border-dotted border-slate-200 pr-1",
                      ordem === "linha" && "h-auto",
                    )}
                    style={{ height: estilo.linha }}
                  >
                    {mostrarRm ? (
                      <span
                        className="shrink-0 font-mono tabular-nums text-slate-500"
                        style={{ fontSize: estilo.rm }}
                      >
                        {item.rm}
                      </span>
                    ) : null}
                    <span
                      className="truncate font-medium text-slate-900"
                      style={{ fontSize: estilo.registro }}
                    >
                      {item.nome} {item.sobrenome}
                    </span>
                    {mostrarObservacoes && item.observacoes ? (
                      <span
                        className="truncate text-slate-400"
                        style={{ fontSize: estilo.rm }}
                        title={item.observacoes}
                      >
                        · {item.observacoes}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <footer
                className="mt-3 flex items-center justify-between border-t border-slate-200 pt-1.5 text-slate-400"
                style={{ fontSize: estilo.rm }}
              >
                <span>
                  {ESCOLA.identificacao} · Arquivo morto · Secretaria Escolar
                </span>
                <span>
                  Folha {indice + 1}/{blocos.length} · {bloco.length} registro(s) nesta folha
                </span>
              </footer>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
