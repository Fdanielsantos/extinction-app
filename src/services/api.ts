// Cliente HTTP real para a API Spring Boot (substitui a antiga camada mockada
// de src/services/mockApi.ts). Mantém as mesmas assinaturas que as telas já
// usavam para minimizar mudanças fora deste arquivo.

import Constants from 'expo-constants';

import { Comentario, Especie, Postagem, PredicaoEspecie, RankingUsuario, Usuario } from '../types';

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

interface ApiErrorBody {
  status: number;
  message: string;
  details?: string[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const resposta = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

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
  fotoUri: string;
  legenda: string;
  especies: Especie[];
  latitude?: number;
  longitude?: number;
}

export async function criarPostagem(input: CriarPostagemInput): Promise<Postagem> {
  const formData = new FormData();
  formData.append('foto', {
    uri: input.fotoUri,
    name: 'foto.jpg',
    type: 'image/jpeg',
  } as any);
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
