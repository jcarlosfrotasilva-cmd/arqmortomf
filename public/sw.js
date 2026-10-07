/**
 * Service worker do Arquivo Morto Escolar.
 *
 * Estratégia pensada para a rotina da secretaria (internet instável, falta de
 * energia):
 *  - Páginas: rede primeiro, caindo para o cache quando estiver offline.
 *  - Arquivos estáticos: cache primeiro (abre instantâneo).
 *  - API de LEITURA (busca, índice, estatísticas, relação): rede primeiro com
 *    cópia em cache — se a internet cair, a última consulta continua visível.
 *  - API de ESCRITA (importar, restaurar, excluir, backup): NUNCA em cache, para
 *    não arriscar dado desatualizado.
 */

const VERSAO = "arquivo-morto-v2";
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const CACHE_ESTATICOS = `${VERSAO}-estaticos`;
const CACHE_DADOS = `${VERSAO}-dados`;

const PAGINAS_PRINCIPAIS = ["/", "/importar", "/importacoes", "/imprimir", "/backup"];
const APIS_LEITURA = [
  "/api/prontuarios",
  "/api/prontuarios/indice",
  "/api/prontuarios/relatorio",
  "/api/estatisticas",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGINAS);
      await Promise.all(
        PAGINAS_PRINCIPAIS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const chaves = await caches.keys();
      await Promise.all(
        chaves
          .filter((chave) => !chave.startsWith(VERSAO))
          .map((chave) => caches.delete(chave)),
      );
      await self.clients.claim();
    })(),
  );
});

function ehApiLeitura(url) {
  return APIS_LEITURA.some((rota) => url.pathname === rota || url.pathname.startsWith(`${rota}/`));
}

async function redePrimeiroComCache(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const resposta = await fetch(request);
    if (resposta && resposta.ok) {
      cache.put(request, resposta.clone()).catch(() => undefined);
    }
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(request);
    if (guardada) {
      const copia = guardada.clone();
      copia.headers.set("X-Offline", "1");
      return copia;
    }
    throw erro;
  }
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/health")) return;

  // Leitura de dados: mantém a última resposta para uso sem internet.
  if (ehApiLeitura(url)) {
    evento.respondWith(redePrimeiroComCache(request, CACHE_DADOS));
    return;
  }

  // Outras rotas de API (escrita/autenticação): sempre rede.
  if (url.pathname.startsWith("/api/")) return;

  // Navegação entre páginas.
  if (request.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(request);
          if (resposta && resposta.ok) {
            const cache = await caches.open(CACHE_PAGINAS);
            cache.put(request, resposta.clone()).catch(() => undefined);
          }
          return resposta;
        } catch {
          const cache = await caches.open(CACHE_PAGINAS);
          const guardada = (await cache.match(request)) ?? (await cache.match("/"));
          if (guardada) return guardada;
          return new Response(
            "<!doctype html><meta charset='utf-8'><title>Sem conexão</title><body style='font-family:system-ui;padding:2rem;text-align:center'><h1>Sem conexão</h1><p>Abra o sistema novamente quando a internet voltar. Os dados estão salvos no servidor.</p></body>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 },
          );
        }
      })(),
    );
    return;
  }

  // Estáticos do Next e ícones.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icone") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ESTATICOS);
        const guardada = await cache.match(request);
        if (guardada) return guardada;
        const resposta = await fetch(request);
        if (resposta && resposta.ok) {
          cache.put(request, resposta.clone()).catch(() => undefined);
        }
        return resposta;
      })(),
    );
  }
});
