import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { mockLogin, mockRegister } from '../services/mockApi';
import { Usuario } from '../types';

const STORAGE_KEY = '@extinction/usuario';

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUsuario(JSON.parse(raw));
      })
      .finally(() => setCarregando(false));
  }, []);

  const persistir = async (novoUsuario: Usuario | null) => {
    setUsuario(novoUsuario);
    if (novoUsuario) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novoUsuario));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      usuario,
      carregando,
      login: async (email, senha) => {
        const logado = await mockLogin(email, senha);
        await persistir(logado);
      },
      registrar: async (nome, email, senha) => {
        const criado = await mockRegister(nome, email, senha);
        await persistir(criado);
      },
      logout: async () => {
        await persistir(null);
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
