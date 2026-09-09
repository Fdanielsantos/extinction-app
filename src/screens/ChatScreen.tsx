import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { fetchMensagens } from '../services/api';
import { conectar, enviarMensagemWs, onErro, onMensagem } from '../services/chatSocket';
import { colors } from '../theme/colors';
import { Mensagem } from '../types';

type Rota = RouteProp<MainStackParamList, 'Chat'>;
type Navegacao = NativeStackNavigationProp<MainStackParamList, 'Chat'>;

// RF: chats diretos e em grupo — thread de uma conversa, tempo real via
// WebSocket (histórico vem por REST só na abertura da tela).
export default function ChatScreen() {
  const { conversaId, nomeExibicao, tipo } = useRoute<Rota>().params;
  const navigation = useNavigation<Navegacao>();
  const { usuario } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: nomeExibicao,
      headerRight:
        tipo === 'GRUPO'
          ? () => (
              <TouchableOpacity onPress={() => navigation.navigate('EditarGrupo', { conversaId })}>
                <Text style={styles.headerBotaoTexto}>Gerenciar</Text>
              </TouchableOpacity>
            )
          : undefined,
    });
  }, [navigation, nomeExibicao, tipo, conversaId]);

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
    enviarMensagemWs(conversaId, textoLimpo, respondendo?.id);
    setTexto('');
    setRespondendo(null);
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
              // Arrastar pro lado (qualquer direção) revela o ícone de responder --
              // ao passar do threshold, marca esta mensagem como "respondendo" e
              // fecha a ação sozinho (sem manter a bolha deslocada).
              <Swipeable
                renderLeftActions={() => (
                  <View style={styles.acaoResponder}>
                    <Text style={styles.acaoResponderTexto}>↩</Text>
                  </View>
                )}
                onSwipeableOpen={(direcao, swipeable) => {
                  setRespondendo(item);
                  swipeable.close();
                }}
                overshootLeft={false}
                leftThreshold={40}
              >
                <View style={[styles.bolha, propria ? styles.bolhaPropria : styles.bolhaAlheia]}>
                  {!propria && <Text style={styles.autorNome}>{item.autorNome}</Text>}
                  {item.respostaA && (
                    <View style={styles.citacao}>
                      <Text style={styles.citacaoAutor}>{item.respostaA.autorNome}</Text>
                      <Text style={styles.citacaoTexto} numberOfLines={1}>
                        {item.respostaA.texto}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.textoMensagem, propria && styles.textoMensagemPropria]}>
                    {item.texto}
                  </Text>
                </View>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.vazio}>
              <Text style={styles.vazioTexto}>Nenhuma mensagem ainda. Diga oi!</Text>
            </View>
          }
        />

        {respondendo && (
          <View style={styles.respondendoBarra}>
            <View style={{ flex: 1 }}>
              <Text style={styles.respondendoAutor}>Respondendo a {respondendo.autorNome}</Text>
              <Text style={styles.respondendoTexto} numberOfLines={1}>
                {respondendo.texto}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setRespondendo(null)}>
              <Text style={styles.respondendoFechar}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

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
  citacao: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 8,
    marginBottom: 4,
    opacity: 0.85,
  },
  citacaoAutor: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  citacaoTexto: {
    fontSize: 12,
    color: colors.textMuted,
  },
  acaoResponder: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acaoResponderTexto: {
    fontSize: 22,
    color: colors.primary,
  },
  headerBotaoTexto: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  respondendoBarra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  respondendoAutor: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  respondendoTexto: {
    fontSize: 12,
    color: colors.textMuted,
  },
  respondendoFechar: {
    color: colors.textMuted,
    fontSize: 16,
    paddingHorizontal: 4,
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
