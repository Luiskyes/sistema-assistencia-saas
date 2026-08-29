export type FuncaoUsuario = "DONO" | "TECNICO" | "RECEPCIONISTA";

export interface ReleaseReport {
  id: string;
  created: string;
  sha256: string;
  status: "RECEBIDO" | "BLOQUEADO" | "AGUARDANDO_EXECUTOR";
  version?: string;
  notice?: string;
  errors: string[];
  checks?: Record<string, string>;
}

export function disponibilidadePlataforma(token: string) {
  return apiFetch<{ homologacao: boolean; autorizado: boolean; executor_configurado: boolean }>(
    "/api/v1/plataforma/disponibilidade", token,
  );
}

export function listarVersoes(token: string) {
  return apiFetch<ReleaseReport[]>("/api/v1/plataforma/versoes", token);
}

export function enviarVersao(token: string, file: File) {
  return apiFetch<ReleaseReport>("/api/v1/plataforma/versoes", token, {
    method: "POST", headers: { "Content-Type": "application/zip" }, body: file,
  });
}

export function analisarVersao(token: string, id: string) {
  return apiFetch<ReleaseReport>(`/api/v1/plataforma/versoes/${id}/analisar`, token, { method: "POST" });
}

export interface UsuarioAutenticado {
  id_usuario: string;
  id_auth: string;
  id_assistencia: string;
  cpf_usuario: string | null;
  nome_usuario: string;
  funcao_usuario: FuncaoUsuario;
  email_usuario: string;
  ativo: boolean;
  data_criacao: string;
}

export interface AssistenciaAtual {
  id_assistencia: string;
  nome_assistencia: string;
  ativo: boolean;
}

export interface SessaoAtual {
  usuario: UsuarioAutenticado;
  assistencia: AssistenciaAtual;
}

export interface Cliente {
  id_cliente: string;
  id_assistencia: string;
  cpf_cliente: string | null;
  nome_cliente: string;
  telefone: string | null;
  endereco_cliente: string | null;
  data_criacao: string;
}

export interface ClientePayload {
  nome_cliente: string;
  cpf_cliente?: string | null;
  telefone?: string | null;
  endereco_cliente?: string | null;
}

export interface Equipamento {
  id_equip: string;
  id_assistencia: string;
  id_cliente: string;
  marca_equip: string | null;
  modelo_equip: string | null;
  cor_equip: string | null;
  num_serie: string | null;
  descr_equip: string | null;
  data_criacao: string;
}

export interface EquipamentoPayload {
  id_cliente: string;
  marca_equip?: string | null;
  modelo_equip?: string | null;
  cor_equip?: string | null;
  num_serie?: string | null;
  descr_equip?: string | null;
}

export interface EstoqueItem {
  id_item: string;
  id_assistencia: string;
  codigo: string;
  descricao: string;
  categoria: string | null;
  marca_compativel: string | null;
  modelo_compativel: string | null;
  quantidade_atual: number;
  quantidade_minima: number;
  custo_unitario: number | null;
  preco_venda: number | null;
  localizacao: string | null;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
}

export interface EstoqueItemPayload {
  codigo: string;
  descricao: string;
  categoria?: string | null;
  marca_compativel?: string | null;
  modelo_compativel?: string | null;
  quantidade_atual: number;
  quantidade_minima: number;
  custo_unitario?: number | null;
  preco_venda?: number | null;
  localizacao?: string | null;
  ativo: boolean;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.trim() ||
  `${window.location.protocol}//${window.location.hostname}:8000`
).replace(/\/$/, "");

const CACHE_TTL_MS = 30_000;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CacheEntry>();
const inflightReads = new Map<string, Promise<unknown>>();

function requestCacheKey(path: string, accessToken: string) {
  return `${accessToken}::${path}`;
}

function invalidateCacheByPath(...fragments: string[]) {
  for (const key of responseCache.keys()) {
    if (fragments.some((fragment) => key.includes(fragment))) {
      responseCache.delete(key);
    }
  }

  for (const key of inflightReads.keys()) {
    if (fragments.some((fragment) => key.includes(fragment))) {
      inflightReads.delete(key);
    }
  }
}

export function limparCacheApi() {
  responseCache.clear();
  inflightReads.clear();
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function mensagemErro(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as {
      detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
    };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) {
      const mensagens = payload.detail
        .filter((item) => item.msg)
        .map((item) => {
          const campo = item.loc?.filter((parte) => parte !== "body").at(-1);
          return campo ? `${String(campo)}: ${item.msg}` : item.msg!;
        });
      if (mensagens.length) return mensagens.join("; ");
    }
  } catch {
    // A resposta pode não ser JSON; será usada uma mensagem segura pelo status.
  }
  return null;
}

function mensagemPorStatus(status: number, fallback: string): string {
  if (status === 400 || status === 422) return "Revise os campos informados e tente novamente.";
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não possui permissão para executar esta ação.";
  if (status === 404) return "O registro solicitado não foi encontrado ou foi removido.";
  if (status === 409) return "Esta operação não pode ser realizada no estado atual.";
  if (status === 429) return "Muitas tentativas em pouco tempo. Aguarde alguns instantes.";
  if (status >= 500) return "O servidor encontrou um problema. Tente novamente em instantes.";
  return fallback;
}

export function mensagemErroUsuario(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof ApiError) return error.message || mensagemPorStatus(error.status, fallback);
  if (error instanceof DOMException && error.name === "AbortError") return "A operação foi interrompida.";
  if (error instanceof TypeError) return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

async function apiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.", 0);
  }

  if (!response.ok) {
    const detail = await mensagemErro(response);
    throw new ApiError(detail ?? mensagemPorStatus(response.status, "Não foi possível concluir a operação."), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}


async function apiFetchBlob(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Accept: "application/pdf",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar ao servidor para gerar o PDF.", 0);
  }

  if (!response.ok) {
    const detail = await mensagemErro(response);
    throw new ApiError(detail ?? mensagemPorStatus(response.status, "Não foi possível gerar a pré-nota."), response.status);
  }

  return response.blob();
}

async function apiGetCached<T>(
  path: string,
  accessToken: string,
  ttlMs = CACHE_TTL_MS,
): Promise<T> {
  const key = requestCacheKey(path, accessToken);
  const cached = responseCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const existing = inflightReads.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = apiFetch<T>(path, accessToken)
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflightReads.delete(key);
    });

  inflightReads.set(key, request);
  return request;
}

export function carregarSessaoAtual(
  accessToken: string,
  signal?: AbortSignal,
): Promise<SessaoAtual> {
  return apiFetch<SessaoAtual>("/api/v1/sessao/atual", accessToken, { signal });
}

export function listarClientes(accessToken: string): Promise<Cliente[]> {
  return apiGetCached<Cliente[]>("/api/v1/clientes?limite=100&pagina=1", accessToken);
}

export async function criarCliente(
  accessToken: string,
  payload: ClientePayload,
): Promise<Cliente> {
  const cliente = await apiFetch<Cliente>("/api/v1/clientes", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/clientes");
  return cliente;
}

export async function atualizarCliente(
  accessToken: string,
  idCliente: string,
  payload: ClientePayload,
): Promise<Cliente> {
  const cliente = await apiFetch<Cliente>(`/api/v1/clientes/${idCliente}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/clientes");
  return cliente;
}

export function listarEquipamentos(accessToken: string): Promise<Equipamento[]> {
  return apiGetCached<Equipamento[]>("/api/v1/equipamentos?limite=100&pagina=1", accessToken);
}

export async function criarEquipamento(
  accessToken: string,
  payload: EquipamentoPayload,
): Promise<Equipamento> {
  const equipamento = await apiFetch<Equipamento>("/api/v1/equipamentos", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/equipamentos");
  return equipamento;
}

export async function atualizarEquipamento(
  accessToken: string,
  idEquip: string,
  payload: EquipamentoPayload,
): Promise<Equipamento> {
  const equipamento = await apiFetch<Equipamento>(`/api/v1/equipamentos/${idEquip}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/equipamentos");
  return equipamento;
}

export function listarEstoque(accessToken: string): Promise<EstoqueItem[]> {
  return apiGetCached<EstoqueItem[]>(
    "/api/v1/estoque?somente_ativos=true&limite=200&pagina=1",
    accessToken,
  );
}

export async function criarItemEstoque(
  accessToken: string,
  payload: EstoqueItemPayload,
): Promise<EstoqueItem> {
  const item = await apiFetch<EstoqueItem>("/api/v1/estoque", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/estoque");
  return item;
}

export async function ajustarEstoque(
  accessToken: string,
  idItem: string,
  quantidadeNova: number,
  motivo: string,
): Promise<EstoqueItem> {
  const item = await apiFetch<EstoqueItem>(`/api/v1/estoque/${idItem}/ajuste`, accessToken, {
    method: "POST",
    body: JSON.stringify({ quantidade_nova: quantidadeNova, motivo }),
  });
  invalidateCacheByPath("/api/v1/estoque");
  return item;
}

export type StatusOS =
  | "RECEBIDO"
  | "EM_ANALISE"
  | "AGUARDANDO_APROVACAO"
  | "EM_MANUTENCAO"
  | "CONCLUIDO"
  | "ENTREGUE"
  | "CANCELADO";

export type PrioridadeOS = "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";

export interface OrdemServico {
  id_os: string;
  id_assistencia: string;
  num_os: string;
  id_cliente: string;
  id_equip: string;
  id_usuario_abertura: string;
  id_tecnico_responsavel: string | null;
  data_aber: string;
  data_atual: string;
  data_conc: string | null;
  data_entre: string | null;
  defeito_relatorio: string;
  diag_os: string | null;
  valor_total: number;
  status_os: StatusOS;
  obser_os: string | null;
  prioridade_os: PrioridadeOS;
  destino_pecas_cancelamento: DestinoPecasCancelamento | null;
  data_cancelamento: string | null;
}

export interface OrdemPayload {
  id_cliente: string;
  id_equip: string;
  id_tecnico_responsavel?: string | null;
  defeito_relatorio: string;
  obser_os?: string | null;
  prioridade_os: PrioridadeOS;
}

export interface OrdemUpdatePayload {
  defeito_relatorio?: string;
  diag_os?: string | null;
  obser_os?: string | null;
  prioridade_os?: PrioridadeOS;
  id_tecnico_responsavel?: string | null;
  valor_total?: number;
}

export type TipoItemOS = "PECA" | "SERVICO";
export type StatusCompraExterna = "SOLICITADA" | "COMPRADA" | "RECEBIDA" | "CANCELADA";
export type DestinoPecasCancelamento = "DEVOLVER_ESTOQUE" | "CONSUMIDAS" | "PERDA";

export interface OrdemItemOS {
  id_item_os: string;
  id_assistencia: string;
  id_os: string;
  tipo: TipoItemOS;
  id_item_estoque: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  fornecedor: string | null;
  custo_unitario: number | null;
  status_compra: StatusCompraExterna | null;
  data_compra: string | null;
  data_recebimento: string | null;
  subtotal: number;
  data_criacao: string;
}

export interface OrdemItemPayload {
  tipo: TipoItemOS;
  id_item_estoque?: string | null;
  descricao?: string | null;
  quantidade: number;
  valor_unitario?: number | null;
  fornecedor?: string | null;
  custo_unitario?: number | null;
}

export interface HistoricoOS {
  id_hist: string;
  id_assistencia: string;
  id_usuario: string | null;
  id_os: string;
  data_evento: string;
  status_anterior: StatusOS | null;
  status_novo: StatusOS;
  obs_hist: string | null;
}

export interface UsuarioOperacional {
  id_usuario: string;
  nome_usuario: string;
  funcao_usuario: FuncaoUsuario;
  ativo: boolean;
}

export function listarUsuariosOperacionais(accessToken: string): Promise<UsuarioOperacional[]> {
  return apiGetCached<UsuarioOperacional[]>(
    "/api/v1/usuarios?somente_ativos=true&limite=100",
    accessToken,
  );
}

export function listarOrdens(accessToken: string): Promise<OrdemServico[]> {
  return apiGetCached<OrdemServico[]>("/api/v1/ordens?limite=100&pagina=1", accessToken, 15_000);
}

export async function criarOrdem(
  accessToken: string,
  payload: OrdemPayload,
): Promise<OrdemServico> {
  const ordem = await apiFetch<OrdemServico>("/api/v1/ordens", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/ordens");
  return ordem;
}

export async function atualizarOrdem(
  accessToken: string,
  idOs: string,
  payload: OrdemUpdatePayload,
): Promise<OrdemServico> {
  const ordem = await apiFetch<OrdemServico>(`/api/v1/ordens/${idOs}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath("/api/v1/ordens");
  return ordem;
}

export async function alterarStatusOrdem(
  accessToken: string,
  idOs: string,
  statusOs: StatusOS,
): Promise<OrdemServico> {
  const ordem = await apiFetch<OrdemServico>(`/api/v1/ordens/${idOs}/status`, accessToken, {
    method: "POST",
    body: JSON.stringify({ status_os: statusOs }),
  });
  invalidateCacheByPath(
    "/api/v1/ordens",
    ...(statusOs === "EM_MANUTENCAO" ? ["/api/v1/estoque"] : []),
  );
  return ordem;
}

export function listarHistoricoOrdem(
  accessToken: string,
  idOs: string,
): Promise<HistoricoOS[]> {
  return apiGetCached<HistoricoOS[]>(`/api/v1/ordens/${idOs}/historico`, accessToken, 10_000);
}

export function listarItensOrdem(accessToken: string, idOs: string): Promise<OrdemItemOS[]> {
  return apiGetCached<OrdemItemOS[]>(`/api/v1/ordens/${idOs}/itens`, accessToken, 10_000);
}

export async function adicionarItemOrdem(
  accessToken: string,
  idOs: string,
  payload: OrdemItemPayload,
): Promise<OrdemItemOS> {
  const item = await apiFetch<OrdemItemOS>(`/api/v1/ordens/${idOs}/itens`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  invalidateCacheByPath(`/api/v1/ordens/${idOs}/itens`, "/api/v1/ordens");
  return item;
}

export async function removerItemOrdem(
  accessToken: string,
  idOs: string,
  idItemOs: string,
): Promise<void> {
  await apiFetch<void>(`/api/v1/ordens/${idOs}/itens/${idItemOs}`, accessToken, {
    method: "DELETE",
  });
  invalidateCacheByPath(`/api/v1/ordens/${idOs}/itens`, "/api/v1/ordens");
}

export async function atualizarCompraExterna(
  accessToken: string,
  idOs: string,
  idItemOs: string,
  statusCompra: StatusCompraExterna,
): Promise<OrdemItemOS> {
  const item = await apiFetch<OrdemItemOS>(
    `/api/v1/ordens/${idOs}/itens/${idItemOs}/compra`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ status_compra: statusCompra }) },
  );
  invalidateCacheByPath(`/api/v1/ordens/${idOs}/itens`);
  return item;
}

export async function cancelarManutencaoOrdem(
  accessToken: string,
  idOs: string,
  destinoPecas: DestinoPecasCancelamento,
): Promise<OrdemServico> {
  const ordem = await apiFetch<OrdemServico>(
    `/api/v1/ordens/${idOs}/cancelamento-manutencao`,
    accessToken,
    { method: "POST", body: JSON.stringify({ destino_pecas: destinoPecas }) },
  );
  invalidateCacheByPath("/api/v1/ordens", "/api/v1/estoque");
  return ordem;
}


export function obterPreNotaPdf(
  accessToken: string,
  idOs: string,
): Promise<Blob> {
  return apiFetchBlob(`/api/v1/ordens/${idOs}/pre-nota.pdf`, accessToken);
}


export function emitirPreNotaPdf(
  accessToken: string,
  idOs: string,
): Promise<Blob> {
  return apiFetchBlob(
    `/api/v1/ordens/${idOs}/pre-nota/impressao`,
    accessToken,
    { method: "POST" },
  );
}
export interface ExecutorState {
  conectado: boolean;
  escopo: string;
  commit?: string;
  referencia?: string;
  runs: { id: number; status: string; conclusion: string | null; commit: string; url: string }[];
}

export function consultarExecutor(accessToken: string): Promise<ExecutorState> {
  return apiFetch<ExecutorState>("/api/v1/plataforma/executor", accessToken);
}

export function testarRepositorio(accessToken: string, commit: string): Promise<{ notice: string }> {
  return apiFetch<{ notice: string }>("/api/v1/plataforma/executor/testar", accessToken, {
    method: "POST", body: JSON.stringify({ expected_sha: commit }),
  });
}
