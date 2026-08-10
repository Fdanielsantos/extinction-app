// Modelos espelhando o Diagrama de Classes do Documento de Arquitetura de Software (Extinction).
// Quando a API Spring Boot estiver disponível, estes tipos devem corresponder aos DTOs do backend.

export type TipoDaConta = 'COMUM' | 'CIENTISTA' | 'ADMIN';

export type StatusEspecieAtual =
  | 'POUCO_PREOCUPANTE'
  | 'QUASE_AMEACADA'
  | 'VULNERAVEL'
  | 'EM_PERIGO'
  | 'CRIATICAMENTE_EM_PERIGO'
  | 'EXTINTA_NA_NATUREZA'
  | 'EXTINTA';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  userName: string;
  dataCadastro: string; // ISO date
}

export interface Perfil {
  id: number;
  idUsuario: number;
  nome: string;
  bio: string;
  fotoUrl?: string;
  tipoDaConta: TipoDaConta;
  totalEspeciesCatalogadas: number;
  selo?: Selo;
}

export interface Selo {
  id: number;
  tipo: string; // ex.: "Especialista"
  descricao: string;
}

export interface Localidade {
  id: number;
  latitude: number;
  longitude: number;
  estado?: string;
  cidade?: string;
}

export interface Especie {
  id: number;
  nomeCientifico: string;
  nomePopular: string;
  descricao: string;
  habitat: string;
  statusEspecieAtual: StatusEspecieAtual;
}

export interface Comentario {
  id: number;
  idPerfil: number;
  autorNome: string;
  descricao: string;
  data: string;
}

export interface Postagem {
  id: number;
  idPerfil: number;
  autorNome: string;
  autorFotoUrl?: string;
  fotoUrl: string;
  legenda: string;
  data: string; // ISO date
  localidade?: Localidade;
  especies: Especie[];
  curtidas: number;
  curtidoPeloUsuario: boolean;
  comentarios: Comentario[];
}

// Resultado mockado do futuro RF018 (Executar Inferência de Imagem via TensorFlow no backend).
export interface PredicaoEspecie {
  especie: Especie;
  confiancaPercentual: number;
}

export interface RankingUsuario {
  idPerfil: number;
  nome: string;
  fotoUrl?: string;
  totalAvistamentosValidados: number;
}
