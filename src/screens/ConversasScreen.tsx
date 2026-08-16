import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { fetchConversas } from '../services/api';
import { conectar, onMensagem } from '../services/chatSocket';
import { colors } from '../theme/colors';
import { Conversa } from '../types';

type Navegacao = NativeStackNavigationProp<MainStackParamList>;

function formatarHora(iso: string): string {
  const data = new Date(iso);
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// RF: chats diretos e em grupo — lista de conversas do usuário, atualizada em
// tempo real via WebSocket enquanto a tela está aberta.
export default function ConversasScreen() {
  const navigation = useNavigation<Navegacao>();
  const { usuario } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      conectar();
      fetchConversas()
        .then(setConversas)
        .finally(() => setCarregando(false));
    }, []),
  );

  useEffect(() => {
    return onMensagem((mensagem) => {
      setConversas((atual) => {
        const existe = atual.some((c) => c.id === mensagem.conversaId);
        if (!existe) return atual;
        const atualizadas = atual.map((c) =>
          c.id === mensagem.conversaId ? { ...c, ultimaMensagem: mensagem } : c,
        );
        return atualizadas.sort((a, b) => {
          const dataA = a.ultimaMensagem?.data ?? '';
          const dataB = b.ultimaMensagem?.data ?? '';
          return dataB.localeCompare(dataA);
        });
      });
    });
  }, []);

  if (carregando) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.carregandoBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Conversas</Text>
        <TouchableOpacity style={styles.botaoNovoGrupo} onPress={() => navigation.navigate('NovoGrupo')}>
          <Text style={styles.botaoNovoGrupoTexto}>+ Grupo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        renderItem={({ item }) => {
          const outroParticipante = item.participantes.find((p) => p.id !== usuario?.id);
          const fotoUrl = item.tipo === 'DIRETA' ? outroParticipante?.fotoUrl : undefined;
          return (
            <TouchableOpacity
              style={styles.linha}
              onPress={() =>
                navigation.navigate('Chat', { conversaId: item.id, nomeExibicao: item.nomeExibicao })
              }
            >
              {fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarVazio]}>
                  <Text style={styles.avatarVazioTexto}>
                    {item.tipo === 'GRUPO' ? '👥' : item.nomeExibicao.charAt(0)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nomeExibicao}</Text>
                <Text style={styles.previa} numberOfLines={1}>
                  {item.ultimaMensagem ? item.ultimaMensagem.texto : 'Nenhuma mensagem ainda'}
                </Text>
              </View>
              {item.ultimaMensagem && (
                <Text style={styles.hora}>{formatarHora(item.ultimaMensagem.data)}</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>
              Nenhuma conversa ainda. Visite o perfil de alguém e toque em "Mensagem" pra começar.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  carregandoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  botaoNovoGrupo: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  botaoNovoGrupoTexto: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarVazio: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarVazioTexto: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  nome: {
    fontWeight: '700',
    color: colors.text,
  },
  previa: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  hora: {
    fontSize: 11,
    color: colors.textMuted,
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  vazioTexto: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
