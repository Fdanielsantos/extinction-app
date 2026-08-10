// Camada de dados MOCKADA. Toda função aqui simula uma chamada à futura API Spring Boot
// (endpoints REST autenticados por JWT, conforme o Documento de Arquitetura).
// Quando o backend estiver disponível, troque o corpo de cada função por uma chamada
// axios/fetch real, mantendo as mesmas assinaturas para não precisar mexer nas telas.

import {
  Comentario,
  Especie,
  Postagem,
  PredicaoEspecie,
  RankingUsuario,
  Usuario,
} from '../types';

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export const MOCK_ESPECIES: Especie[] = [
  {
    id: 1,
    nomeCientifico: 'Leontopithecus rosalia',
    nomePopular: 'Mico-leão-dourado',
    descricao:
      'Pequeno primata de pelagem dourada, símbolo da conservação da Mata Atlântica.',
    habitat: 'Mata Atlântica (RJ)',
    statusEspecieAtual: 'EM_PERIGO',
  },
  {
    id: 2,
    nomeCientifico: 'Chrysocyon brachyurus',
    nomePopular: 'Lobo-guará',
    descricao: 'Maior canídeo da América do Sul, típico do Cerrado brasileiro.',
    habitat: 'Cerrado',
    statusEspecieAtual: 'QUASE_AMEACADA',
  },
  {
    id: 3,
    nomeCientifico: 'Araucaria angustifolia',
    nomePopular: 'Araucária',
    descricao: 'Conífera nativa da Mata Atlântica, também chamada de pinheiro-do-paraná.',
    habitat: 'Mata Atlântica (Sul)',
    statusEspecieAtual: 'CRIATICAMENTE_EM_PERIGO',
  },
  {
    id: 4,
    nomeCientifico: 'Panthera onca',
    nomePopular: 'Onça-pintada',
    descricao: 'Maior felino das Américas, topo da cadeia alimentar em vários biomas.',
    habitat: 'Amazônia, Pantanal, Cerrado',
    statusEspecieAtual: 'VULNERAVEL',
  },
  {
    id: 5,
    nomeCientifico: 'Anodorhynchus leari',
    nomePopular: 'Arara-azul-de-lear',
    descricao: 'Ave endêmica da Bahia, com população historicamente muito reduzida.',
    habitat: 'Caatinga (BA)',
    statusEspecieAtual: 'EM_PERIGO',
  },
];

export const MOCK_POSTAGENS: Postagem[] = [
  {
    id: 101,
    idPerfil: 1,
    autorNome: 'Flávio Santos',
    fotoUrl:
      'https://images.unsplash.com/photo-1590930610994-3e2e3f4d5a2b?w=800&q=60',
    legenda: 'Avistamento incrível durante trilha na Serra dos Órgãos!',
    data: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    localidade: { id: 1, latitude: -22.4568, longitude: -42.9928, estado: 'RJ', cidade: 'Teresópolis' },
    especies: [MOCK_ESPECIES[0]],
    curtidas: 12,
    curtidoPeloUsuario: false,
    comentarios: [
      {
        id: 1,
        idPerfil: 2,
        autorNome: 'Ana Bióloga',
        descricao: 'Identificação confirmada, ótimo registro!',
        data: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ],
  },
  {
    id: 102,
    idPerfil: 2,
    autorNome: 'Ana Bióloga',
    fotoUrl:
      'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800&q=60',
    legenda: 'Lobo-guará cruzando a estrada ao entardecer, Chapada dos Veadeiros.',
    data: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    localidade: { id: 2, latitude: -14.1347, longitude: -47.5155, estado: 'GO', cidade: 'Alto Paraíso' },
    especies: [MOCK_ESPECIES[1]],
    curtidas: 34,
    curtidoPeloUsuario: true,
    comentarios: [],
  },
];

export const MOCK_RANKING: RankingUsuario[] = [
  { idPerfil: 2, nome: 'Ana Bióloga', totalAvistamentosValidados: 48 },
  { idPerfil: 1, nome: 'Flávio Santos', totalAvistamentosValidados: 21 },
  { idPerfil: 3, nome: 'Guilherme Alves', totalAvistamentosValidados: 15 },
];

let nextPostagemId = 103;

// ---- RF009 / HU01 / HU02: Autenticação ----

export async function mockLogin(email: string, senha: string): Promise<Usuario> {
  await delay();
  if (!email.includes('@')) {
    throw new Error('E-mail inválido.');
  }
  if (senha.length < 6) {
    throw new Error('Credenciais incorretas.');
  }
  return {
    id: 1,
    nome: 'Flávio Santos',
    email,
    userName: email.split('@')[0],
    dataCadastro: new Date().toISOString(),
  };
}

export async function mockRegister(
  nome: string,
  email: string,
  senha: string,
): Promise<Usuario> {
  await delay();
  if (senha.length < 8) {
    throw new Error('A senha deve ter no mínimo 8 caracteres.');
  }
  return {
    id: Date.now(),
    nome,
    email,
    userName: email.split('@')[0],
    dataCadastro: new Date().toISOString(),
  };
}

export async function mockRequestPasswordReset(email: string): Promise<void> {
  await delay();
  if (!email.includes('@')) {
    throw new Error('E-mail inválido.');
  }
}

// ---- RF013 / HU06: Feed ----

export async function fetchFeed(): Promise<Postagem[]> {
  await delay();
  return [...MOCK_POSTAGENS].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );
}

export async function toggleCurtida(postagemId: number): Promise<Postagem> {
  await delay(200);
  const postagem = MOCK_POSTAGENS.find((p) => p.id === postagemId);
  if (!postagem) throw new Error('Postagem não encontrada.');
  postagem.curtidoPeloUsuario = !postagem.curtidoPeloUsuario;
  postagem.curtidas += postagem.curtidoPeloUsuario ? 1 : -1;
  return postagem;
}

export async function adicionarComentario(
  postagemId: number,
  descricao: string,
): Promise<Comentario> {
  await delay(300);
  const postagem = MOCK_POSTAGENS.find((p) => p.id === postagemId);
  if (!postagem) throw new Error('Postagem não encontrada.');
  const comentario: Comentario = {
    id: Date.now(),
    idPerfil: 1,
    autorNome: 'Você',
    descricao,
    data: new Date().toISOString(),
  };
  postagem.comentarios.push(comentario);
  return comentario;
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
  await delay(800);
  const postagem: Postagem = {
    id: nextPostagemId++,
    idPerfil: 1,
    autorNome: 'Flávio Santos',
    fotoUrl: input.fotoUri,
    legenda: input.legenda,
    data: new Date().toISOString(),
    localidade:
      input.latitude != null && input.longitude != null
        ? { id: Date.now(), latitude: input.latitude, longitude: input.longitude }
        : undefined,
    especies: input.especies,
    curtidas: 0,
    curtidoPeloUsuario: false,
    comentarios: [],
  };
  MOCK_POSTAGENS.unshift(postagem);
  return postagem;
}

// ---- RF018: Executar Inferência de Imagem ----
// TODO: substituir por POST /especies/inferencia no backend Spring Boot (classe TFmodel / DJL).
export async function classificarImagemMock(_fotoUri: string): Promise<PredicaoEspecie[]> {
  await delay(1500);
  const embaralhadas = [...MOCK_ESPECIES].sort(() => Math.random() - 0.5);
  return embaralhadas.slice(0, 3).map((especie, index) => ({
    especie,
    confiancaPercentual: Math.round(90 - index * 22 - Math.random() * 8),
  }));
}

// ---- RF014 / HU07: Enciclopédia ----

export async function fetchEspecies(): Promise<Especie[]> {
  await delay();
  return MOCK_ESPECIES;
}

// ---- RF007 / HU: Ranking (gamificação) ----

export async function fetchRanking(): Promise<RankingUsuario[]> {
  await delay();
  return MOCK_RANKING;
}
