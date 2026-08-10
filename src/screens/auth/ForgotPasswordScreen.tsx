import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { mockRequestPasswordReset } from '../../services/mockApi';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    setErro(null);
    setSucesso(false);
    if (!email.trim()) {
      setErro('Informe seu e-mail cadastrado.');
      return;
    }
    setEnviando(true);
    try {
      await mockRequestPasswordReset(email.trim());
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o link.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Recuperar senha</Text>
      <Text style={styles.descricao}>
        Informe o e-mail cadastrado para receber o link de redefinição de senha.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      {sucesso ? (
        <Text style={styles.sucesso}>Link de recuperação enviado! Verifique seu e-mail.</Text>
      ) : null}

      <TouchableOpacity style={styles.botaoPrimario} onPress={handleEnviar} disabled={enviando}>
        {enviando ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.botaoPrimarioTexto}>Enviar link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Voltar para o login</Text>
      </TouchableOpacity>
    </View>
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  descricao: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
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
  sucesso: {
    color: colors.primary,
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
