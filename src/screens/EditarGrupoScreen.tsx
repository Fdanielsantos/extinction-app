import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import {
  adicionarParticipante,
  fetchConversas,
  fetchUsuarios,
  removerParticipante,
} from '../services/api';
import { colors } from '../theme/colors';
import { Conversa, UsuarioPublico } from '../types';

type Rota = RouteProp<MainStackParamList, 'EditarGrupo'>;
type Navegacao = NativeStackNavigationProp<MainStackParamList>;

// RF: editar grupo (adicionar/remover integrantes) -- só o criador do grupo
// pode gerenciar; qualquer participante pode sair sozinho.
export default function EditarGrupoScreen() {
  const { conversaId } = useRoute<Rota>().params;
  const navigation = useNavigation<Navegacao>();
  const { usuario } = useAuth();
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [candidatos, setCandidatos] = useState<UsuarioPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const [conversas, usuarios] = await Promise.all([fetchConversas(), fetchUsuarios()]);
    const atual = conversas.find((c) => c.id === conversaId) ?? null;
    setConversa(atual);
    setCandidatos(usuarios);
  }, [conversaId]);

  useFocusEffect(
    useCallback(() => {
      carregar().finally(() => setCarregando(false));
    }, [carregar]),
  );

  const ehCriador = conversa && usuario && conversa.criadorId === usuario.id;

  const handleAdicionar = async (usuarioId: number) => {
    setProcessandoId(usuarioId);
    try {
      const atualizada = await adicionarParticipante(conversaId, usuarioId);
      setConversa(atualizada);
    } catch (erro) {
      Alert.alert('Não foi possível adicionar', erro instanceof Error ? erro.message : 'Tente novamente.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleRemover = (usuarioId: number, ehVoceMesmo: boolean) => {
    Alert.alert(
      ehVoceMesmo ? 'Sair do grupo' : 'Remover participante',
      ehVoceMesmo
        ? 'Tem certeza que deseja sair deste grupo?'
        : 'Tem certeza que deseja remover este participante do grupo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: ehVoceMesmo ? 'Sair' : 'Remover',
          style: 'destructive',
          onPress: async () => {
            setProcessandoId(usuarioId);
            try {
              if (ehVoceMesmo) {
                await removerParticipante(conversaId, usuarioId);
                navigation.navigate('MainTabs');
                return;
              }
              const atualizada = await removerParticipante(conversaId, usuarioId);
              setConversa(atualizada);
            } catch (erro) {
              Alert.alert('Não foi possível remover', erro instanceof Error ? erro.message : 'Tente novamente.');
            } finally {
              setProcessandoId(null);
            }
          },
        },
      ],
    );
  };

  if (carregando || !conversa) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.carregandoBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const idsAtuais = new Set(conversa.participantes.map((p) => p.id));
  const usuariosForaDoGrupo = candidatos.filter((u) => !idsAtuais.has(u.id));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={conversa.participantes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={<Text style={styles.secaoTitulo}>Participantes ({conversa.participantes.length})</Text>}
        renderItem={({ item }) => {
          const ehVoceMesmo = item.id === usuario?.id;
          const ehCriadorDoItem = item.id === conversa.criadorId;
          const podeRemover = !ehCriadorDoItem && (ehCriador || ehVoceMesmo);
          return (
            <View style={styles.linha}>
              <Text style={styles.nome}>
                {item.nome}
                {ehCriadorDoItem ? ' · admin' : ''}
              </Text>
              {podeRemover && (
                <TouchableOpacity onPress={() => handleRemover(item.id, ehVoceMesmo)} disabled={processandoId === item.id}>
                  {processandoId === item.id ? (
                    <ActivityIndicator color={colors.danger} size="small" />
                  ) : (
                    <Text style={styles.acaoRemover}>{ehVoceMesmo ? 'Sair' : 'Remover'}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          ehCriador ? (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.secaoTitulo}>Adicionar participante</Text>
              {usuariosForaDoGrupo.length === 0 ? (
                <Text style={styles.vazioTexto}>Todo mundo cadastrado já está no grupo.</Text>
              ) : (
                usuariosForaDoGrupo.map((item) => (
                  <View key={item.id} style={styles.linha}>
                    <Text style={styles.nome}>{item.nome}</Text>
                    <TouchableOpacity onPress={() => handleAdicionar(item.id)} disabled={processandoId === item.id}>
                      {processandoId === item.id ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Text style={styles.acaoAdicionar}>Adicionar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ) : null
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
  secaoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  nome: {
    color: colors.text,
    fontWeight: '500',
  },
  acaoRemover: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  acaoAdicionar: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  vazioTexto: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
