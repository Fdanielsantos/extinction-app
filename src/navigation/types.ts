export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Mapa: undefined;
  NovoAvistamento: undefined;
  Enciclopedia: undefined;
  Conversas: undefined;
  Perfil: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  PerfilUsuario: { idUsuario: number };
  Seguidores: undefined;
  EditarPerfil: undefined;
  Chat: { conversaId: number; nomeExibicao: string };
  NovoGrupo: undefined;
};
