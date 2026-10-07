import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ESCOLA } from "@/lib/escola";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `Arquivo Morto · ${ESCOLA.nome} — ${ESCOLA.cidade}`,
    template: `%s · Arquivo Morto · ${ESCOLA.nome}`,
  },
  description: `Sistema de ${ESCOLA.sistema.toLowerCase()} da ${ESCOLA.identificacao}: consulta de prontuários por nome e sobrenome, importação de planilhas, impressão em colunas e backup.`,
  applicationName: "Arquivo Morto Escolar",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Arquivo Morto",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Não bloqueamos o zoom: acessibilidade em telas pequenas.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#f4f9f8] text-slate-900 antialiased">{children}</body>
    </html>
  );
}
