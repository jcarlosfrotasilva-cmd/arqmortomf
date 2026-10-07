"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, cx, filtrosParaQueryString, requisitar } from "@/lib/client/api";
import { Botao, CampoSelect, CampoTexto, Cartao, Etiqueta, Modal, Rotulo, Vazio } from "@/components/ui";
import { IndiceAlfabetico } from "@/components/IndiceAlfabetico";
import { ProntuarioModal } from "@/components/ProntuarioModal";
import { ResultadosModal } from "@/components/ResultadosModal";
import { useToast } from "@/components/toast";
import {
  IconArchive,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconEdit,
  IconHistory,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconUpload,
  IconUsers,
} from "@/components/icons";
import { RmDestaque } from "@/components/RmDestaque";
import { SeloOffline } from "@/components/ServicoApp";
import { formatDate, initials } from "@/lib/text";

const CHAVE_CACHE = "arquivo-morto:ultima-consulta";
import {
  TAMANHOS_PAGINA_CLIENTE,
  type CampoIndice,
  type ConsultaChave,
  type LetraIndice,
  type Estatisticas,
  type FiltrosBusca,
  type ListaProntuarios,
  type Prontuario,
} from "@/lib/types";

const FILTROS_INICIAIS: FiltrosBusca = {
  nome: "",
  sobrenome: "",
  rm: "",
  letra: "",
  campoLetra: "sobrenome",
  ordenarPor: "sobrenome",
  direcao: "asc",
  pagina: 1,
  tamanhoPagina: 25,
};

const CONSULTA_VAZIA: ConsultaChave = { nome: "", sobrenome: "", rm: "" };

function Indicador({
  rotulo,
  valor,
  descricao,
  Icone,
  tom,
}: {
  rotulo: string;
  valor: string | number;
  descricao: string;
  Icone: typeof IconUsers;
  tom: "teal" | "emerald" | "amber" | "slate";
}) {
  const tons = {
    teal: "bg-teal-50 text-teal-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  } as const;

  return (
    <Cartao className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{valor}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{descricao}</p>
        </div>
        <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", tons[tom])}>
          <Icone className="h-5 w-5" />
        </span>
      </div>
    </Cartao>
  );
}

export function ConsultaView() {
  const { notificar } = useToast();
  const [busca, setBusca] = useState<ConsultaChave>(CONSULTA_VAZIA);
  const [consultaAtiva, setConsultaAtiva] = useState<ConsultaChave | null>(null);
  const [tabela, setTabela] = useState<FiltrosBusca>(FILTROS_INICIAIS);
  const [lista, setLista] = useState<ListaProntuarios | null>(null);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dadosSalvos, setDadosSalvos] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [indice, setIndice] = useState<LetraIndice[]>([]);
  const [carregandoIndice, setCarregandoIndice] = useState(true);
  const [versao, setVersao] = useState(0);
  const [modalFormulario, setModalFormulario] = useState<
    { modo: "criar" } | { modo: "editar"; prontuario: Prontuario } | null
  >(null);
  const [paraExcluir, setParaExcluir] = useState<Prontuario | null>(null);
  const [excluindoLote, setExcluindoLote] = useState(false);
  const [processando, setProcessando] = useState(false);

  const carregarEstatisticas = useCallback(async () => {
    try {
      const dados = await requisitar<{ estatisticas: Estatisticas }>("/api/estatisticas");
      setEstatisticas(dados.estatisticas);
    } catch {
      /* indicadores são complementares */
    }
  }, []);

  useEffect(() => {
    void carregarEstatisticas();
  }, [carregarEstatisticas]);

  useEffect(() => {
    const controlador = new AbortController();
    setCarregandoIndice(true);

    requisitar<{ letras: LetraIndice[] }>(
      `/api/prontuarios/indice?campo=${tabela.campoLetra}`,
      { signal: controlador.signal },
    )
      .then((dados) => setIndice(dados.letras))
      .catch(() => setIndice([]))
      .finally(() => {
        if (!controlador.signal.aborted) setCarregandoIndice(false);
      });

    return () => controlador.abort();
  }, [tabela.campoLetra, versao]);

  useEffect(() => {
    const controlador = new AbortController();
    const query = filtrosParaQueryString({
      ordenarPor: tabela.ordenarPor,
      direcao: tabela.direcao,
      pagina: tabela.pagina,
      tamanhoPagina: tabela.tamanhoPagina,
      letra: tabela.letra,
      campoLetra: tabela.campoLetra,
    });

    setCarregando(true);
    requisitar<ListaProntuarios>(`/api/prontuarios?${query}`, { signal: controlador.signal })
      .then((dados) => {
        setLista(dados);
        setErro(null);
        setDadosSalvos(null);
        setSelecionados([]);
        try {
          window.localStorage.setItem(
            CHAVE_CACHE,
            JSON.stringify({ em: new Date().toISOString(), tabela, dados }),
          );
        } catch {
          /* sem espaço no aparelho: segue normalmente */
        }
      })
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === "AbortError") return;

        // Sem conexão com o servidor: mostra a última consulta salva no aparelho.
        try {
          const bruto = window.localStorage.getItem(CHAVE_CACHE);
          if (bruto) {
            const salvo = JSON.parse(bruto) as { em: string; dados: ListaProntuarios };
            setLista(salvo.dados);
            setDadosSalvos(
              new Date(salvo.em).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
            );
            setErro(null);
            return;
          }
        } catch {
          /* cache indisponível */
        }

        setErro(falha instanceof Error ? falha.message : "Não foi possível carregar os prontuários.");
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(false);
      });

    return () => controlador.abort();
  }, [tabela, versao]);

  const recarregar = useCallback(() => {
    setVersao((valor) => valor + 1);
    void carregarEstatisticas();
  }, [carregarEstatisticas]);

  const abrirConsulta = (evento?: React.FormEvent<HTMLFormElement>) => {
    evento?.preventDefault();
    if (!busca.nome.trim() && !busca.sobrenome.trim() && !busca.rm.trim()) {
      notificar({
        tipo: "info",
        titulo: "Informe um termo de busca",
        descricao: "Digite o nome ou o sobrenome do aluno para listar os prontuários.",
      });
      return;
    }
    setConsultaAtiva({
      nome: busca.nome.trim(),
      sobrenome: busca.sobrenome.trim(),
      rm: busca.rm.trim(),
    });
  };

  const chaveConsulta = consultaAtiva
    ? `${consultaAtiva.nome}|${consultaAtiva.sobrenome}|${consultaAtiva.rm}`
    : "fechado";

  const itens = lista?.itens ?? [];
  const todosSelecionados = itens.length > 0 && selecionados.length === itens.length;

  const alternarSelecao = (id: number) => {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((valor) => valor !== id) : [...atual, id],
    );
  };

  const excluirProntuario = async () => {
    if (!paraExcluir) return;
    setProcessando(true);
    try {
      await requisitar<{ removido: { id: number } }>(`/api/prontuarios/${paraExcluir.id}`, {
        method: "DELETE",
      });
      notificar({
        tipo: "sucesso",
        titulo: "Prontuário excluído",
        descricao: `${paraExcluir.nome} ${paraExcluir.sobrenome} · RM ${paraExcluir.rm}`,
      });
      setParaExcluir(null);
      recarregar();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao excluir",
        descricao: falha instanceof ApiError ? falha.message : "Tente novamente em instantes.",
      });
    } finally {
      setProcessando(false);
    }
  };

  const excluirSelecionados = async () => {
    setProcessando(true);
    try {
      const resposta = await requisitar<{ removidos: number }>("/api/prontuarios/lote", {
        method: "POST",
        body: JSON.stringify({ ids: selecionados }),
      });
      notificar({
        tipo: "sucesso",
        titulo: `${resposta.removidos} prontuário(s) excluído(s)`,
        descricao: "Os registros selecionados foram removidos do arquivo morto.",
      });
      setExcluindoLote(false);
      setSelecionados([]);
      recarregar();
    } catch (falha) {
      notificar({
        tipo: "erro",
        titulo: "Falha ao excluir registros",
        descricao: falha instanceof ApiError ? falha.message : "Tente novamente em instantes.",
      });
    } finally {
      setProcessando(false);
    }
  };

  const urlExportacao = useMemo(
    () =>
      `/api/prontuarios/exportar?${filtrosParaQueryString({
        ordenarPor: tabela.ordenarPor,
        direcao: tabela.direcao,
        letra: tabela.letra,
        campoLetra: tabela.campoLetra,
      })}`,
    [tabela.campoLetra, tabela.direcao, tabela.letra, tabela.ordenarPor],
  );

  const resumoPagina =
    lista && lista.total > 0
      ? `Exibindo ${(lista.pagina - 1) * lista.tamanhoPagina + 1}–${Math.min(
          lista.pagina * lista.tamanhoPagina,
          lista.total,
        )} de ${lista.total} registros`
      : "Nenhum registro";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Prontuários no arquivo"
          valor={estatisticas?.total ?? "–"}
          descricao="Total de registros cadastrados"
          Icone={IconUsers}
          tom="teal"
        />
        <Indicador
          rotulo="Sobrenomes distintos"
          valor={estatisticas?.totalSobrenomes ?? "–"}
          descricao="Famílias localizáveis na busca"
          Icone={IconArchive}
          tom="emerald"
        />
        <Indicador
          rotulo="Cadastrados em 7 dias"
          valor={estatisticas?.totalUltimosSeteDias ?? "–"}
          descricao="Novos registros recentes"
          Icone={IconUpload}
          tom="amber"
        />
        <Indicador
          rotulo="Última importação"
          valor={
            estatisticas?.ultimaImportacao
              ? `${estatisticas.ultimaImportacao.inseridos + estatisticas.ultimaImportacao.atualizados}`
              : "–"
          }
          descricao={
            estatisticas?.ultimaImportacao
              ? `${estatisticas.ultimaImportacao.arquivo} · ${formatDate(estatisticas.ultimaImportacao.createdAt)}`
              : "Nenhuma planilha importada ainda"
          }
          Icone={IconHistory}
          tom="slate"
        />
      </div>

      <Cartao className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Consultar prontuário</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Busque por <strong>nome</strong> e/ou <strong>sobrenome</strong>: o resultado lista os
              registros em uma janela. A busca é por <strong>início de palavra</strong> — “Ana”
              encontra “Ana Clara”, e não “Mariana”. Acentos e maiúsculas não fazem diferença.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/imprimir?${filtrosParaQueryString({
                nome: busca.nome.trim(),
                sobrenome: busca.sobrenome.trim(),
                rm: busca.rm.trim(),
                letra: tabela.letra,
                campoLetra: tabela.campoLetra,
              })}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconPrinter className="h-4 w-4" />
              Imprimir em colunas
            </Link>
            <Botao
              type="button"
              variante="primario"
              icone={<IconPlus className="h-4 w-4" />}
              onClick={() => setModalFormulario({ modo: "criar" })}
            >
              Novo registro
            </Botao>
          </div>
        </div>

        <form onSubmit={abrirConsulta} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1.4fr_1fr_auto]">
          <div>
            <Rotulo htmlFor="busca-nome">Nome</Rotulo>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch className="h-4 w-4" />
              </span>
              <CampoTexto
                id="busca-nome"
                value={busca.nome}
                onChange={(evento) => setBusca((atual) => ({ ...atual, nome: evento.target.value }))}
                placeholder="Ex.: Ana"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <Rotulo htmlFor="busca-sobrenome">Sobrenome</Rotulo>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch className="h-4 w-4" />
              </span>
              <CampoTexto
                id="busca-sobrenome"
                value={busca.sobrenome}
                onChange={(evento) =>
                  setBusca((atual) => ({ ...atual, sobrenome: evento.target.value }))
                }
                placeholder="Ex.: Silva"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <Rotulo htmlFor="busca-rm">RM (opcional)</Rotulo>
            <CampoTexto
              id="busca-rm"
              value={busca.rm}
              onChange={(evento) => setBusca((atual) => ({ ...atual, rm: evento.target.value }))}
              placeholder="Ex.: 123456"
              autoComplete="off"
            />
          </div>
          <div className="flex items-end gap-2">
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                setBusca(CONSULTA_VAZIA);
                setConsultaAtiva(null);
              }}
            >
              Limpar
            </Botao>
            <Botao type="submit" variante="primario" icone={<IconSearch className="h-4 w-4" />}>
              Consultar
            </Botao>
          </div>
        </form>
      </Cartao>

      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-900">
              Acervo completo · {lista ? `${lista.total} registro(s)` : "carregando..."}
            </p>
            {tabela.letra ? (
              <button
                type="button"
                onClick={() => setTabela((atual) => ({ ...atual, letra: "", pagina: 1 }))}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200 transition hover:bg-teal-100"
                title="Remover o filtro de letra"
              >
                {tabela.letra === "#"
                  ? `${tabela.campoLetra === "nome" ? "Nome" : "Sobrenome"} com número ou símbolo`
                  : `${tabela.campoLetra === "nome" ? "Nome" : "Sobrenome"} começando com ${tabela.letra}`}
                <IconClose className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {dadosSalvos ? <SeloOffline salvoEm={dadosSalvos} className="hidden sm:inline-flex" /> : null}
            <span className="hidden text-xs text-slate-500 sm:inline">{resumoPagina}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selecionados.length > 0 ? (
              <div className="animar-surgir flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-200">
                {selecionados.length} selecionado(s)
                <button
                  type="button"
                  className="text-teal-600 underline hover:text-teal-800"
                  onClick={() => setSelecionados([])}
                >
                  limpar
                </button>
                <Botao
                  type="button"
                  variante="perigo"
                  className="px-2 py-1 text-xs"
                  icone={<IconTrash className="h-3.5 w-3.5" />}
                  onClick={() => setExcluindoLote(true)}
                >
                  Excluir
                </Botao>
              </div>
            ) : null}
            <CampoSelect
              aria-label="Ordenar prontuários por"
              value={tabela.ordenarPor}
              onChange={(evento) =>
                setTabela((atual) => ({
                  ...atual,
                  ordenarPor: evento.target.value as FiltrosBusca["ordenarPor"],
                  pagina: 1,
                }))
              }
              className="w-44 py-1.5 text-xs"
            >
              <option value="sobrenome">Ordenar por sobrenome</option>
              <option value="nome">Ordenar por nome</option>
              <option value="rm">Ordenar por RM</option>
              <option value="recentes">Cadastrados recentemente</option>
            </CampoSelect>
            <CampoSelect
              aria-label="Registros por página"
              value={tabela.tamanhoPagina}
              onChange={(evento) =>
                setTabela((atual) => ({
                  ...atual,
                  tamanhoPagina: Number(evento.target.value),
                  pagina: 1,
                }))
              }
              className="w-24 py-1.5 text-xs"
            >
              {TAMANHOS_PAGINA_CLIENTE.map((tamanho) => (
                <option key={tamanho} value={tamanho}>
                  {tamanho}/pág.
                </option>
              ))}
            </CampoSelect>
            <a
              href={urlExportacao}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconDownload className="h-4 w-4" />
              Exportar Excel
            </a>
          </div>
        </div>

        <div className="px-4 pt-3.5">
          <IndiceAlfabetico
            letras={indice}
            letraAtiva={tabela.letra}
            campo={tabela.campoLetra}
            carregando={carregandoIndice}
            totalFiltrado={lista?.total}
            onCampoChange={(campo: CampoIndice) =>
              setTabela((atual) => ({ ...atual, campoLetra: campo, letra: "", pagina: 1 }))
            }
            onSelecionar={(letra) =>
              setTabela((atual) => ({ ...atual, letra: letra ?? "", pagina: 1 }))
            }
          />
        </div>

        {erro ? (
          <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}

        {!carregando && !erro && itens.length === 0 ? (
          <Vazio
            icone={<IconArchive className="h-6 w-6" />}
            titulo={
              tabela.letra
                ? "Nenhum prontuário com esta letra"
                : "Arquivo morto vazio"
            }
            descricao={
              tabela.letra
                ? `Não encontramos registros de ${tabela.campoLetra === "nome" ? "nome" : "sobrenome"} com a letra ${tabela.letra}. Clique em “Todos os registros” para ver o acervo completo.`
                : "Importe a planilha com RM, nome e sobrenome dos alunos ou cadastre o primeiro prontuário manualmente."
            }
            acao={
              tabela.letra ? (
                <Botao
                  type="button"
                  variante="secundario"
                  onClick={() => setTabela((atual) => ({ ...atual, letra: "", pagina: 1 }))}
                >
                  Ver todos os registros
                </Botao>
              ) : (
                <Botao
                  type="button"
                  variante="primario"
                  icone={<IconPlus className="h-4 w-4" />}
                  onClick={() => setModalFormulario({ modo: "criar" })}
                >
                  Cadastrar prontuário
                </Botao>
              )
            }
          />
        ) : (
          <>
            {/* Celular: cartões empilhados, sem rolagem lateral */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {itens.map((item) => (
                <li key={`cartao-${item.id}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${item.nome} ${item.sobrenome}`}
                        checked={selecionados.includes(item.id)}
                        onChange={() => alternarSelecao(item.id)}
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-700"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.nome} {item.sobrenome}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <RmDestaque rm={item.rm} variante="cartao" />
                          <span className="text-xs text-slate-500">
                            Cadastro: {formatDate(item.createdAt)}
                          </span>
                        </div>
                        {item.observacoes ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.observacoes}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Editar prontuário"
                        aria-label={`Editar ${item.nome} ${item.sobrenome}`}
                        onClick={() => setModalFormulario({ modo: "editar", prontuario: item })}
                        className="rounded-lg p-2.5 text-slate-400 transition hover:bg-teal-50 hover:text-teal-700"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Excluir prontuário"
                        aria-label={`Excluir ${item.nome} ${item.sobrenome}`}
                        onClick={() => setParaExcluir(item)}
                        className="rounded-lg p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {carregando && itens.length === 0
                ? Array.from({ length: 4 }).map((_, indice) => (
                    <li key={`cartao-esqueleto-${indice}`} className="px-4 py-4">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    </li>
                  ))
                : null}
            </ul>

            {/* Tablet e desktop: tabela completa */}
            <div className="tabela-rolagem hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-sm sm:min-w-0 lg:min-w-[820px]">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os registros da página"
                      checked={todosSelecionados}
                      onChange={(evento) =>
                        setSelecionados(evento.target.checked ? itens.map((item) => item.id) : [])
                      }
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">RM</th>
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Sobrenome</th>
                  <th className="px-3 py-3 font-semibold">Observações</th>
                  <th className="px-3 py-3 font-semibold">Cadastro</th>
                  <th className="px-3 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {carregando && itens.length === 0
                  ? Array.from({ length: 6 }).map((_, indice) => (
                      <tr key={`esqueleto-${indice}`}>
                        <td colSpan={7} className="px-3 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : itens.map((item) => (
                      <tr
                        key={item.id}
                        className={cx(
                          "transition hover:bg-slate-50/80",
                          selecionados.includes(item.id) && "bg-teal-50/40",
                        )}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${item.nome} ${item.sobrenome}`}
                            checked={selecionados.includes(item.id)}
                            onChange={() => alternarSelecao(item.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <RmDestaque rm={item.rm} variante="tabela" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                              {initials(item.nome, item.sobrenome)}
                            </span>
                            <span className="font-medium text-slate-900">{item.nome}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">{item.sobrenome}</td>
                        <td className="max-w-[18rem] px-3 py-3 text-xs text-slate-500">
                          {item.observacoes ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Editar prontuário"
                              aria-label={`Editar ${item.nome} ${item.sobrenome}`}
                              onClick={() => setModalFormulario({ modo: "editar", prontuario: item })}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-600"
                            >
                              <IconEdit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Excluir prontuário"
                              aria-label={`Excluir ${item.nome} ${item.sobrenome}`}
                              onClick={() => setParaExcluir(item)}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {lista && lista.totalPaginas > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Página {lista.pagina} de {lista.totalPaginas}
            </p>
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <Botao
                type="button"
                variante="secundario"
                className="flex-1 px-2.5 py-1.5 text-xs sm:flex-none"
                disabled={lista.pagina <= 1 || carregando}
                onClick={() => setTabela((atual) => ({ ...atual, pagina: lista.pagina - 1 }))}
              >
                <IconChevronLeft className="h-4 w-4" />
                Anterior
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                className="flex-1 px-2.5 py-1.5 text-xs sm:flex-none"
                disabled={lista.pagina >= lista.totalPaginas || carregando}
                onClick={() => setTabela((atual) => ({ ...atual, pagina: lista.pagina + 1 }))}
              >
                Próxima
                <IconChevronRight className="h-4 w-4" />
              </Botao>
            </div>
          </div>
        ) : null}
      </Cartao>

      {consultaAtiva ? (
        <ResultadosModal
          key={chaveConsulta}
          consulta={consultaAtiva}
          refreshKey={versao}
          onFechar={() => setConsultaAtiva(null)}
          onEditar={(prontuario) => setModalFormulario({ modo: "editar", prontuario })}
          onExcluir={(prontuario) => setParaExcluir(prontuario)}
        />
      ) : null}

      <ProntuarioModal
        aberto={modalFormulario !== null}
        prontuario={modalFormulario?.modo === "editar" ? modalFormulario.prontuario : null}
        onFechar={() => setModalFormulario(null)}
        onSalvo={recarregar}
      />

      <Modal
        aberto={paraExcluir !== null}
        onFechar={() => setParaExcluir(null)}
        titulo="Excluir prontuário"
        descricao="Esta ação remove o registro definitivamente do arquivo morto e não pode ser desfeita."
        largura="max-w-lg"
        rodape={
          <>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setParaExcluir(null)}
              disabled={processando}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              carregando={processando}
              icone={<IconTrash className="h-4 w-4" />}
              onClick={() => void excluirProntuario()}
            >
              Excluir prontuário
            </Botao>
          </>
        }
      >
        {paraExcluir ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">
              {paraExcluir.nome} {paraExcluir.sobrenome}
            </p>
            <p className="mt-1 flex items-center gap-2 text-slate-600">
              <RmDestaque rm={paraExcluir.rm} variante="compacto" />
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        aberto={excluindoLote}
        onFechar={() => setExcluindoLote(false)}
        titulo="Excluir registros selecionados"
        descricao={`${selecionados.length} prontuário(s) serão removidos definitivamente.`}
        largura="max-w-lg"
        rodape={
          <>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setExcluindoLote(false)}
              disabled={processando}
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              carregando={processando}
              icone={<IconTrash className="h-4 w-4" />}
              onClick={() => void excluirSelecionados()}
            >
              Excluir selecionados
            </Botao>
          </>
        }
      >
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Etiqueta tom="rose">Atenção</Etiqueta>
          <span>
            Recomendamos exportar a planilha de Excel antes de remover registros para manter um
            backup do arquivo morto.
          </span>
        </div>
      </Modal>
    </div>
  );
}
