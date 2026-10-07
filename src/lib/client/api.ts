export function cx(...valores: (string | false | null | undefined)[]): string {
  return valores.filter(Boolean).join(" ");
}

export class ApiError extends Error {
  erros: Record<string, string>;

  constructor(mensagem: string, erros: Record<string, string> = {}) {
    super(mensagem);
    this.name = "ApiError";
    this.erros = erros;
  }
}

export async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const texto = await resposta.text();
  const dados = texto ? (JSON.parse(texto) as unknown) : null;

  if (!resposta.ok) {
    const objeto = (dados ?? {}) as { mensagem?: string; erros?: Record<string, string> };
    throw new ApiError(objeto.mensagem ?? "Ocorreu um erro inesperado.", objeto.erros ?? {});
  }

  return dados as T;
}

export function filtrosParaQueryString(
  filtros: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined || valor === "") return;
    params.set(chave, String(valor));
  });
  return params.toString();
}
