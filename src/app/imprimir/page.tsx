import { AppShell } from "@/components/AppShell";
import { ImpressaoView } from "@/components/ImpressaoView";

export const dynamic = "force-dynamic";

import type { CampoIndice } from "@/lib/types";

type Props = {
  searchParams: Promise<{
    nome?: string;
    sobrenome?: string;
    rm?: string;
    letra?: string;
    campoLetra?: string;
  }>;
};

export default async function PaginaImprimir({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <AppShell
      titulo="Impressão em papel"
      subtitulo="Monte a relação de prontuários em 1 a 4 colunas, escolha orientação e tamanho da letra, e imprima ou salve em PDF com o cabeçalho da escola em cada folha."
    >
      <ImpressaoView
        filtrosIniciais={{
          nome: (params.nome ?? "").trim(),
          sobrenome: (params.sobrenome ?? "").trim(),
          rm: (params.rm ?? "").trim(),
          letra: (params.letra ?? "").trim().slice(0, 1).toUpperCase(),
          campoLetra: (params.campoLetra === "nome" ? "nome" : "sobrenome") as CampoIndice,
        }}
      />
    </AppShell>
  );
}
