import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ESCOLA } from "@/lib/escola";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `Arquivo Morto · ${ESCOLA.nome} — ${ESCOLA.cidade}`,
    template: `%s · Arquivo Morto · ${ESCOLA.nome}`,
  },
  description: `Sistema de ${ESCOLA.sistema.toLowerCase()} da ${ESCOLA.identificacao}: cadastro por importação de planilha Excel, consulta por nome e sobrenome, edição e exclusão de prontuários.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#f4f9f8] text-slate-900 antialiased">{children}</body>
    </html>
  );
}
