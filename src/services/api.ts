// Cliente HTTP real para a API Spring Boot (substitui a antiga camada mockada
// de src/services/mockApi.ts). Mantém as mesmas assinaturas que as telas já
// usavam para minimizar mudanças fora deste arquivo.

import Constants from 'expo-constants';

import {
  Comentario,
  Conversa,
  Especie,
  Mensagem,
  Postagem,
  PredicaoEspecie,
  RankingUsuario,
  Usuario,
  UsuarioPublico,
} from '../types';

function resolverBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // Deriva o IP de LAN a partir do próprio endereço que o Metro Bundler está
  // usando para servir o app — evita hardcodar o IP do PC (muda a cada rede).
  const hostUri =
    Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : undefined;
  return host ? `http://${host}:8080` : 'http://localhost:8080';
}

export const API_BASE_URL = resolverBaseUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Usado pelo cliente WebSocket do chat, que não passa pelo `request()` acima. */
export function getAuthToken(): string | null {
  return authToken;
}

interface ApiErrorBody {
  status: number;
  message: string;
  details?: string[];
}

// Sem isso, um `fetch` contra um host inalcançável (IP errado, backend fora do
// ar, celular fora da rede) fica pendente indefinidamente -- a UI trava num
// spinner pra sempre, sem erro nenhum pro usuário.
const TIMEOUT_MS = 30000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (erro) {
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    }
    throw erro;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!resposta.ok) {
    const corpo: ApiErrorBody | null = await resposta.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Erro inesperado ao comunicar com o servidor.');
  }
  if (resposta.status === 204) {
    return undefined as T;
  }
  return resposta.json();
}

// ---- RF009 / HU01 / HU02: Autenticação ----

interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export async function login(email: string, senha: string): Promise<AuthResponse> {
  const resposta = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  setAuthToken(resposta.token);
  return resposta;
}

export async function register(nome: string, email: string, senha: string): Promise<AuthResponse> {
  const resposta = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha }),
  });
  setAuthToken(resposta.token);
  return resposta;
}

// ---- RF013 / HU06: Feed ----

export async function fetchFeed(): Promise<Postagem[]> {
  return request<Postagem[]>('/api/postagens');
}

export async function toggleCurtida(postagemId: number): Promise<Postagem> {
  return request<Postagem>(`/api/postagens/${postagemId}/curtir`, { method: 'POST' });
}

export async function adicionarComentario(postagemId: number, descricao: string): Promise<Comentario> {
  return request<Comentario>(`/api/postagens/${postagemId}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ descricao }),
  });
}

// ---- RF011 / RF016 / HU04: Criar avistamento ----

export interface CriarPostagemInput {
  fotoUris: string[];
  legenda: string;
  especies: Especie[];
  latitude?: number;
  longitude?: number;
}

export async function criarPostagem(input: CriarPostagemInput): Promise<Postagem> {
  const formData = new FormData();
  input.fotoUris.forEach((uri, indice) => {
    formData.append('fotos', {
      uri,
      name: `foto${indice}.jpg`,
      type: 'image/jpeg',
    } as any);
  });
  formData.append('legenda', input.legenda);
  input.especies.forEach((especie) => formData.append('especieIds', String(especie.id)));
  if (input.latitude != null) formData.append('latitude', String(input.latitude));
  if (input.longitude != null) formData.append('longitude', String(input.longitude));

  return request<Postagem>('/api/postagens', {
    method: 'POST',
    body: formData,
  });
}

// ---- RF018: Executar Inferência de Imagem ----

export async function classificarImagem(fotoUri: string): Promise<PredicaoEspecie[]> {
  const formData = new FormData();
  formData.append('foto', {
    uri: fotoUri,
    name: 'foto.jpg',
    type: 'image/jpeg',
  } as any);

  return request<PredicaoEspecie[]>('/api/especies/inferencia', {
    method: 'POST',
    body: formData,
  });
}

// ---- RF014 / HU07: Enciclopédia ----

export async function fetchEspecies(): Promise<Especie[]> {
  return request<Especie[]>('/api/especies');
}

// ---- RF007 / HU: Ranking (gamificação) ----

export async function fetchRanking(): Promise<RankingUsuario[]> {
  return request<RankingUsuario[]>('/api/ranking');
}

// ---- RF: seguir outros usuários ----

export async function fetchUsuarios(): Promise<UsuarioPublico[]> {
  return request<UsuarioPublico[]>('/api/usuarios');
}

export async function fetchUsuarioPublico(id: number): Promise<UsuarioPublico> {
  return request<UsuarioPublico>(`/api/usuarios/${id}`);
}

export async function alternarSeguir(id: number): Promise<UsuarioPublico> {
  return request<UsuarioPublico>(`/api/usuarios/${id}/seguir`, { method: 'POST' });
}

// ---- RF: gerenciamento de perfil ----

export interface AtualizarPerfilInput {
  nome: string;
  bio?: string;
  fotoUri?: string;
}

export async function atualizarPerfil(input: AtualizarPerfilInput): Promise<Usuario> {
  const formData = new FormData();
  formData.append('nome', input.nome);
  if (input.bio != null) formData.append('bio', input.bio);
  if (input.fotoUri) {
    formData.append('foto', {
      uri: input.fotoUri,
      name: 'foto.jpg',
      type: 'image/jpeg',
    } as any);
  }

  return request<Usuario>('/api/usuarios/me', {
    method: 'PUT',
    body: formData,
  });
}

// ---- RF: chats diretos e em grupo ----

export async function fetchConversas(): Promise<Conversa[]> {
  return request<Conversa[]>('/api/conversas');
}

export async function obterOuCriarConversaDireta(idOutroUsuario: number): Promise<Conversa> {
  return request<Conversa>(`/api/conversas/direta/${idOutroUsuario}`, { method: 'POST' });
}

export async function criarGrupo(nome: string, participanteIds: number[]): Promise<Conversa> {
  return request<Conversa>('/api/conversas/grupo', {
    method: 'POST',
    body: JSON.stringify({ nome, participanteIds }),
  });
}

export async function fetchMensagens(conversaId: number): Promise<Mensagem[]> {
  return request<Mensagem[]>(`/api/conversas/${conversaId}/mensagens`);
}
