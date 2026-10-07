"use client";

import { useEffect, useState } from "react";
import { ApiError, requisitar } from "@/lib/client/api";
import { Botao, CampoTexto, Modal, Rotulo } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Prontuario } from "@/lib/types";

type Formulario = {
  rm: string;
  nome: string;
  sobrenome: string;
  observacoes: string;
};

const FORMULARIO_VAZIO: Formulario = {
  rm: "",
  nome: "",
  sobrenome: "",
  observacoes: "",
};

export function ProntuarioModal({
  aberto,
  prontuario,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  prontuario: Prontuario | null;
  onFechar: () => void;
  onSalvo: (prontuario: Prontuario) => void;
}) {
  const { notificar } = useToast();
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErros({});
    setFormulario(
      prontuario
        ? {
            rm: prontuario.rm,
            nome: prontuario.nome,
            sobrenome: prontuario.sobrenome,
            observacoes: prontuario.observacoes ?? "",
          }
        : FORMULARIO_VAZIO,
    );
  }, [aberto, prontuario]);

  const atualizar = (campo: keyof Formulario, valor: string) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => {
      if (!atual[campo]) return atual;
      const copia = { ...atual };
      delete copia[campo];
      return copia;
    });
  };

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnviando(true);
    setErros({});

    try {
      const resposta = await requisitar<{ prontuario: Prontuario }>(
        prontuario ? `/api/prontuarios/${prontuario.id}` : "/api/prontuarios",
        {
          method: prontuario ? "PUT" : "POST",
          body: JSON.stringify(formulario),
        },
      );

      notificar({
        tipo: "sucesso",
        titulo: prontuario ? "Prontuário atualizado" : "Prontuário cadastrado",
        descricao: `${resposta.prontuario.nome} ${resposta.prontuario.sobrenome} · RM ${resposta.prontuario.rm}`,
      });
      onSalvo(resposta.prontuario);
      onFechar();
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErros(erro.erros);
        notificar({
          tipo: "erro",
          titulo: "Não foi possível salvar",
          descricao: erro.message,
        });
      } else {
        notificar({ tipo: "erro", titulo: "Erro inesperado ao salvar o prontuário." });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={prontuario ? "Editar prontuário" : "Novo prontuário"}
      descricao={
        prontuario
          ? `Registro RM ${prontuario.rm} — alterações são aplicadas imediatamente.`
          : "Cadastre manualmente um prontuário que ainda não está no arquivo morto."
      }
      rodape={
        <>
          <Botao type="button" variante="secundario" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form="formulario-prontuario"
            variante="primario"
            carregando={enviando}
          >
            {prontuario ? "Salvar alterações" : "Cadastrar prontuário"}
          </Botao>
        </>
      }
    >
      <form id="formulario-prontuario" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="rm" obrigatorio>
            RM
          </Rotulo>
          <CampoTexto
            id="rm"
            value={formulario.rm}
            onChange={(evento) => atualizar("rm", evento.target.value)}
            erro={erros.rm}
            placeholder="Ex.: 123456"
            autoComplete="off"
            maxLength={30}
            required
          />
        </div>
        <div>
          <Rotulo htmlFor="nome" obrigatorio>
            Nome
          </Rotulo>
          <CampoTexto
            id="nome"
            value={formulario.nome}
            onChange={(evento) => atualizar("nome", evento.target.value)}
            erro={erros.nome}
            placeholder="Ex.: Maria"
            autoComplete="off"
            maxLength={120}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="sobrenome" obrigatorio>
            Sobrenome
          </Rotulo>
          <CampoTexto
            id="sobrenome"
            value={formulario.sobrenome}
            onChange={(evento) => atualizar("sobrenome", evento.target.value)}
            erro={erros.sobrenome}
            placeholder="Ex.: Silva Souza"
            autoComplete="off"
            maxLength={160}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="observacoes">Observações</Rotulo>
          <textarea
            id="observacoes"
            value={formulario.observacoes}
            onChange={(evento) => atualizar("observacoes", evento.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Informações de controle interno (transferência, situação do prontuário, etc.)"
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline focus:outline-2 focus:outline-teal-500"
          />
          {erros.observacoes ? (
            <p className="mt-1 text-xs font-medium text-rose-600">{erros.observacoes}</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
