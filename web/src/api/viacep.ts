export interface CepAddress {
  street: string;
  district: string;
  city: string;
  state: string;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

export class CepNotFoundError extends Error {
  constructor() {
    super("CEP não encontrado.");
    this.name = "CepNotFoundError";
  }
}

export async function lookupCep(digits: string, signal?: AbortSignal): Promise<CepAddress> {
  let res: Response;
  try {
    res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Não foi possível consultar o CEP.");
  }

  if (!res.ok) throw new Error("Não foi possível consultar o CEP.");

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) throw new CepNotFoundError();

  return {
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: (data.uf ?? "").toUpperCase(),
  };
}
