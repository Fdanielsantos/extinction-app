import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { fetchMensagens } from '../services/api';
import { conectar, enviarMensagemWs, onErro, onMensagem } from '../services/chatSocket';
import { colors } from '../theme/colors';
import { Mensagem } from '../types';

type Rota = RouteProp<MainStackParamList, 'Chat'>;

// RF: chats diretos e em grupo — thread de uma conversa, tempo real via
// WebSocket (histórico vem por REST só na abertura da tela).
export default function ChatScreen() {
  const { conversaId, nomeExibicao } = useRoute<Rota>().params;
  const navigation = useNavigation();
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: nomeExibicao });
  }, [navigation, nomeExibicao]);

  useFocusEffect(
    useCallback(() => {
      conectar();
      fetchMensagens(conversaId).then(setMensagens);
    }, [conversaId]),
  );

  useEffect(() => {
    const cancelarMensagem = onMensagem((mensagem) => {
      if (mensagem.conversaId !== conversaId) return;
      setMensagens((atual) => (atual.some((m) => m.id === mensagem.id) ? atual : [...atual, mensagem]));
    });
    const cancelarErro = onErro((mensagemErro) => {
      // eslint-disable-next-line no-console
      console.warn('Erro no chat:', mensagemErro);
    });
    return () => {
      cancelarMensagem();
      cancelarErro();
    };
  }, [conversaId]);

  const enviar = () => {
    const textoLimpo = texto.trim();
    if (!textoLimpo) return;
    enviarMensagemWs(conversaId, textoLimpo);
    setTexto('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={mensagens}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const propria = item.autorId === usuario?.id;
            return (
              <View style={[styles.bolha, propria ? styles.bolhaPropria : styles.bolhaAlheia]}>
                {!propria && <Text style={styles.autorNome}>{item.autorNome}</Text>}
                <Text style={[styles.textoMensagem, propria && styles.textoMensagemPropria]}>
                  {item.texto}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.vazio}>
              <Text style={styles.vazioTexto}>Nenhuma mensagem ainda. Diga oi!</Text>
            </View>
          }
        />

        <View style={styles.linhaEnvio}>
          <TextInput
            style={styles.input}
            placeholder="Escreva uma mensagem..."
            value={texto}
            onChangeText={setTexto}
            multiline
          />
          <TouchableOpacity style={styles.botaoEnviar} onPress={enviar} disabled={!texto.trim()}>
            <Text style={styles.botaoEnviarTexto}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bolha: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  bolhaPropria: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  bolhaAlheia: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autorNome: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  textoMensagem: {
    color: colors.text,
  },
  textoMensagemPropria: {
    color: colors.surface,
  },
  linhaEnvio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
  },
  botaoEnviar: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botaoEnviarTexto: {
    color: colors.surface,
    fontWeight: '600',
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 40,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
});
