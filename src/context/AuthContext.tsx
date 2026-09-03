import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  login as apiLogin,
  register as apiRegister,
  setAuthToken,
  setOnSessaoExpirada,
} from '../services/api';
import { Usuario } from '../types';

const STORAGE_KEY = '@extinction/usuario';
const TOKEN_STORAGE_KEY = '@extinction/token';

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  atualizarUsuario: (usuario: Usuario) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(TOKEN_STORAGE_KEY)])
      .then(([rawUsuario, token]) => {
        if (rawUsuario && token) {
          setAuthToken(token);
          setUsuario(JSON.parse(rawUsuario));
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  const persistir = useCallback(async (novoUsuario: Usuario | null, token: string | null) => {
    setUsuario(novoUsuario);
    setAuthToken(token);
    if (novoUsuario && token) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novoUsuario));
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  // Qualquer chamada à API que voltar 401 (token expirado/inválido) cai aqui —
  // derruba a sessão local pra o RootNavigator voltar pro login em vez de
  // deixar o usuário preso em telas autenticadas que só retornam erro.
  useEffect(() => {
    setOnSessaoExpirada(() => {
      persistir(null, null);
    });
    return () => setOnSessaoExpirada(null);
  }, [persistir]);

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      carregando,
      login: async (email, senha) => {
        const { usuario: logado, token } = await apiLogin(email, senha);
        await persistir(logado, token);
      },
      registrar: async (nome, email, senha) => {
        const { usuario: criado, token } = await apiRegister(nome, email, senha);
        await persistir(criado, token);
      },
      logout: async () => {
        await persistir(null, null);
      },
      atualizarUsuario: async (novoUsuario) => {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novoUsuario));
        setUsuario(novoUsuario);
      },
    }),
    [usuario, carregando],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  }
  return context;
}
