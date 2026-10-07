"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cx, filtrosParaQueryString, requisitar } from "@/lib/client/api";
import { Botao, CampoSelect, Etiqueta, Modal, Vazio } from "@/components/ui";
import { IndiceAlfabetico } from "@/components/IndiceAlfabetico";
import { RmDestaque } from "@/components/RmDestaque";
import { SeloOffline } from "@/components/ServicoApp";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEdit,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconUsers,
} from "@/components/icons";
import { formatDate, initials } from "@/lib/text";
import {
  TAMANHOS_PAGINA_CLIENTE,
  type CampoIndice,
  type ConsultaChave,
  type LetraIndice,
  type ListaProntuarios,
  type Ordenacao,
  type Prontuario,
} from "@/lib/types";

export function ResultadosModal({
  consulta,
  refreshKey,
  onFechar,
  onEditar,
  onExcluir,
}: {
  consulta: ConsultaChave;
  refreshKey: number;
  onFechar: () => void;
  onEditar: (prontuario: Prontuario) => void;
  onExcluir: (prontuario: Prontuario) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(25);
  const [ordenarPor, setOrdenarPor] = useState<Ordenacao>("sobrenome");
  const [resposta, setResposta] = useState<{ query: string; lista: ListaProntuarios } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [letra, setLetra] = useState("");
  const [campoLetra, setCampoLetra] = useState<CampoIndice>("sobrenome");
  const [indiceResposta, setIndiceResposta] = useState<{
    chave: string;
    letras: LetraIndice[];
  } | null>(null);

  const filtros = useMemo(
    () => ({
      nome: consulta.nome,
      sobrenome: consulta.sobrenome,
      rm: consulta.rm,
      letra,
      campoLetra,
      ordenarPor,
      direcao: "asc" as const,
    }),
    [consulta.nome, consulta.sobrenome, consulta.rm, letra, campoLetra, ordenarPor],
  );

  const query = useMemo(
    () => filtrosParaQueryString({ ...filtros, pagina, tamanhoPagina }),
    [filtros, pagina, tamanhoPagina],
  );

  const chaveIndice = useMemo(
    () =>
      filtrosParaQueryString({
        campo: campoLetra,
        nome: consulta.nome,
        sobrenome: consulta.sobrenome,
        rm: consulta.rm,
      }),
    [campoLetra, consulta.nome, consulta.sobrenome, consulta.rm],
  );

  useEffect(() => {
    const controlador = new AbortController();

    requisitar<{ letras: LetraIndice[] }>(`/api/prontuarios/indice?${chaveIndice}`, {
      signal: controlador.signal,
    })
      .then((dados) => setIndiceResposta({ chave: chaveIndice, letras: dados.letras }))
      .catch(() => setIndiceResposta({ chave: chaveIndice, letras: [] }));

    return () => controlador.abort();
  }, [chaveIndice, refreshKey]);

  const indice = indiceResposta?.letras ?? [];
  const carregandoIndice = indiceResposta?.chave !== chaveIndice;

  useEffect(() => {
    const controlador = new AbortController();

    (async () => {
      try {
        const dados = await requisitar<ListaProntuarios>(`/api/prontuarios?${query}`, {
          signal: controlador.signal,
        });
        setResposta({ query, lista: dados });
        setErro(null);
      } catch (falha) {
        if (falha instanceof DOMException && falha.name === "AbortError") return;

        // Sem servidor: usa a última resposta guardada pelo service worker.
        try {
          if (typeof caches !== "undefined") {
            const guardada = await caches.match(`/api/prontuarios?${query}`);
            if (guardada) {
              setResposta({ query, lista: (await guardada.json()) as ListaProntuarios });
              setErro(null);
              setOffline(true);
              return;
            }
          }
        } catch {
          /* cache indisponível */
        }

        setErro(falha instanceof Error ? falha.message : "Não foi possível concluir a consulta.");
      }
    })();

    return () => controlador.abort();
  }, [query, refreshKey]);

  const lista = resposta?.query === query ? resposta.lista : null;
  const carregando = lista === null && erro === null;

  const urlExportacao = useMemo(
    () => `/api/prontuarios/exportar?${filtrosParaQueryString(filtros)}`,
    [filtros],
  );

  const urlImpressao = useMemo(
    () =>
      `/imprimir?${filtrosParaQueryString({
        nome: consulta.nome,
        sobrenome: consulta.sobrenome,
        rm: consulta.rm,
        letra,
        campoLetra,
      })}`,
    [consulta.nome, consulta.sobrenome, consulta.rm, letra, campoLetra],
  );

  const descricaoConsulta = useMemo(() => {
    const partes: string[] = [];
    if (consulta.nome) partes.push(`nome começando com “${consulta.nome}”`);
    if (consulta.sobrenome) partes.push(`sobrenome começando com “${consulta.sobrenome}”`);
    if (consulta.rm) partes.push(`RM contendo “${consulta.rm}”`);
    return partes.length > 0 ? partes.join(" e ") : "todos os prontuários do arquivo morto";
  }, [consulta]);

  const itens = lista?.itens ?? [];

  const irParaPagina = useCallback((nova: number) => {
    setPagina(nova);
  }, []);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="max-w-5xl"
      titulo="Resultados da consulta"
      descricao={`Busca por ${descricaoConsulta} · cada termo precisa iniciar a palavra.`}
    >
      <div className="space-y-4">
        <IndiceAlfabetico
          letras={indice}
          letraAtiva={letra}
          campo={campoLetra}
          carregando={carregandoIndice}
          totalFiltrado={lista?.total}
          onCampoChange={(campo) => {
            setCampoLetra(campo);
            setLetra("");
            setPagina(1);
          }}
          onSelecionar={(selecionada) => {
            setLetra(selecionada ?? "");
            setPagina(1);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tom="teal">
              <IconUsers className="h-3.5 w-3.5" />
              {lista ? `${lista.total} prontuário(s)` : "consultando..."}
            </Etiqueta>
            {lista && lista.total > 0 ? (
              <span className="text-xs text-slate-500">
                Página {lista.pagina} de {lista.totalPaginas}
              </span>
            ) : null}
            {offline ? <SeloOffline /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CampoSelect
              aria-label="Ordenar resultados por"
              value={ordenarPor}
              onChange={(evento) => {
                setOrdenarPor(evento.target.value as Ordenacao);
                setPagina(1);
              }}
              className="w-44 py-1.5 text-xs"
            >
              <option value="sobrenome">Ordenar por sobrenome</option>
              <option value="nome">Ordenar por nome</option>
              <option value="rm">Ordenar por RM</option>
            </CampoSelect>
            <CampoSelect
              aria-label="Resultados por página"
              value={tamanhoPagina}
              onChange={(evento) => {
                setTamanhoPagina(Number(evento.target.value));
                setPagina(1);
              }}
              className="w-24 py-1.5 text-xs"
            >
              {TAMANHOS_PAGINA_CLIENTE.map((tamanho) => (
                <option key={tamanho} value={tamanho}>
                  {tamanho}/pág.
                </option>
              ))}
            </CampoSelect>
            <Link
              href={urlImpressao}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconPrinter className="h-4 w-4" />
              Imprimir em colunas
            </Link>
            <a
              href={urlExportacao}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <IconDownload className="h-4 w-4" />
              Exportar resultado
            </a>
          </div>
        </div>

        {erro ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}

        {carregando && itens.length === 0 ? (
          <div className="space-y-2 py-4">
            {[0, 1, 2, 3].map((linha) => (
              <div key={linha} className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : null}

        {!carregando && !erro && itens.length === 0 ? (
          <Vazio
            icone={<IconSearch className="h-6 w-6" />}
            titulo="Nenhum prontuário encontrado"
            descricao={
              letra
                ? `Nenhum resultado com ${campoLetra === "nome" ? "nome" : "sobrenome"} na letra ${letra}. Clique em “Todos os registros” para voltar à lista completa.`
                : `Não há registros com ${descricaoConsulta}. Lembre-se: a busca localiza palavras que COMEÇAM com o termo digitado — “Ana” encontra “Ana Clara”, mas não “Mariana”.`
            }
            acao={
              <Link
                href="/importar"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <IconDownload className="h-4 w-4" />
                Importar planilha do acervo
              </Link>
            }
          />
        ) : null}

        {itens.length > 0 ? (
          <div className="tabela-rolagem max-h-[26rem] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">RM</th>
                  <th className="px-4 py-2.5 font-semibold">Nome</th>
                  <th className="px-4 py-2.5 font-semibold">Sobrenome</th>
                  <th className="px-4 py-2.5 font-semibold">Observações</th>
                  <th className="px-4 py-2.5 font-semibold">Cadastro</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((item) => (
                  <tr
                    key={item.id}
                    className={cx("transition hover:bg-slate-50/80", carregando && "opacity-60")}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <RmDestaque rm={item.rm} variante="tabela" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                          {initials(item.nome, item.sobrenome)}
                        </span>
                        <span className="font-medium text-slate-900">{item.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{item.sobrenome}</td>
                    <td className="max-w-[16rem] px-4 py-2.5 text-xs text-slate-500">
                      {item.observacoes ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar prontuário"
                          aria-label={`Editar ${item.nome} ${item.sobrenome}`}
                          onClick={() => onEditar(item)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-600"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Excluir prontuário"
                          aria-label={`Excluir ${item.nome} ${item.sobrenome}`}
                          onClick={() => onExcluir(item)}
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
        ) : null}

        {lista && lista.totalPaginas > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Exibindo {(lista.pagina - 1) * lista.tamanhoPagina + 1}–
              {Math.min(lista.pagina * lista.tamanhoPagina, lista.total)} de {lista.total} registros
            </p>
            <div className="flex items-center gap-1.5">
              <Botao
                type="button"
                variante="secundario"
                className="px-2.5 py-1.5 text-xs"
                disabled={lista.pagina <= 1 || carregando}
                onClick={() => irParaPagina(lista.pagina - 1)}
              >
                <IconChevronLeft className="h-4 w-4" />
                Anterior
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                className="px-2.5 py-1.5 text-xs"
                disabled={lista.pagina >= lista.totalPaginas || carregando}
                onClick={() => irParaPagina(lista.pagina + 1)}
              >
                Próxima
                <IconChevronRight className="h-4 w-4" />
              </Botao>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
