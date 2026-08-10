import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// Regras de senha do HU01 (Cenários 1.11 a 1.13): mínimo 8 caracteres, letras e números.
function validarSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
  if (!/[0-9]/.test(senha)) return 'A senha deve conter ao menos um número.';
  if (!/[a-zA-Z]/.test(senha)) return 'A senha deve conter ao menos uma letra.';
  return null;
}

export default function RegisterScreen({ navigation }: Props) {
  const { registrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleRegister = async () => {
    setErro(null);

    if (!nome.trim() || !email.trim() || !senha || !confirmarSenha) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!email.includes('@')) {
      setErro('Informe um e-mail válido.');
      return;
    }
    const erroSenha = validarSenha(senha);
    if (erroSenha) {
      setErro(erroSenha);
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas informadas são diferentes.');
      return;
    }

    setEnviando(true);
    try {
      await registrar(nome.trim(), email.trim(), senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.titulo}>Criar conta</Text>

      <TextInput style={styles.input} placeholder="Nome completo" value={nome} onChangeText={setNome} />
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Senha" secureTextEntry value={senha} onChangeText={setSenha} />
      <TextInput
        style={styles.input}
        placeholder="Confirmar senha"
        secureTextEntry
        value={confirmarSenha}
        onChangeText={setConfirmarSenha}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      <TouchableOpacity style={styles.botaoPrimario} onPress={handleRegister} disabled={enviando}>
        {enviando ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.botaoPrimarioTexto}>Cadastrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Já tenho uma conta</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  erro: {
    color: colors.danger,
    marginBottom: 12,
  },
  botaoPrimario: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoPrimarioTexto: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
