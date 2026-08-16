import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import {
  adicionarComentario,
  alternarSeguir,
  fetchFeed,
  fetchUsuarioPublico,
  obterOuCriarConversaDireta,
  toggleCurtida,
} from '../services/api';
import { colors } from '../theme/colors';
import { Postagem, UsuarioPublico } from '../types';

type Rota = RouteProp<MainStackParamList, 'PerfilUsuario'>;
type Navegacao = NativeStackNavigationProp<MainStackParamList>;

// RF: seguir outros usuários — perfil público de outro usuário, acessado ao
// tocar no autor de uma postagem no Feed ou na busca de "Seguidores".
export default function PerfilUsuarioScreen() {
  const { idUsuario } = useRoute<Rota>().params;
  const navigation = useNavigation<Navegacao>();
  const { usuario: usuarioLogado } = useAuth();
  const [usuarioPublico, setUsuarioPublico] = useState<UsuarioPublico | null>(null);
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alternandoSeguir, setAlternandoSeguir] = useState(false);
  const [abrindoChat, setAbrindoChat] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchUsuarioPublico(idUsuario), fetchFeed()])
        .then(([perfil, feed]) => {
          setUsuarioPublico(perfil);
          setPostagens(feed.filter((p) => p.idPerfil === idUsuario));
        })
        .finally(() => setCarregando(false));
    }, [idUsuario]),
  );

  const handleAlternarSeguir = async () => {
    setAlternandoSeguir(true);
    try {
      setUsuarioPublico(await alternarSeguir(idUsuario));
    } finally {
      setAlternandoSeguir(false);
    }
  };

  const handleAbrirChat = async () => {
    setAbrindoChat(true);
    try {
      const conversa = await obterOuCriarConversaDireta(idUsuario);
      navigation.navigate('Chat', { conversaId: conversa.id, nomeExibicao: conversa.nomeExibicao });
    } finally {
      setAbrindoChat(false);
    }
  };

  const handleCurtir = async (id: number) => {
    setPostagens((atual) =>
      atual.map((p) =>
        p.id === id
          ? { ...p, curtidoPeloUsuario: !p.curtidoPeloUsuario, curtidas: p.curtidas + (p.curtidoPeloUsuario ? -1 : 1) }
          : p,
      ),
    );
    const atualizada = await toggleCurtida(id);
    setPostagens((atual) => atual.map((p) => (p.id === id ? atualizada : p)));
  };

  const handleComentar = async (id: number, descricao: string) => {
    const comentario = await adicionarComentario(id, descricao);
    setPostagens((atual) =>
      atual.map((p) => (p.id === id ? { ...p, comentarios: [...p.comentarios, comentario] } : p)),
    );
  };

  if (carregando || !usuarioPublico) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.carregandoBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const especiesDistintas = new Set(postagens.flatMap((p) => p.especies.map((e) => e.id)));
  const ehOProprioUsuario = usuarioLogado?.id === idUsuario;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={postagens}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => (
          <PostCard postagem={item} onCurtir={handleCurtir} onComentar={handleComentar} />
        )}
        ListHeaderComponent={
          <View style={styles.cabecalho}>
            {usuarioPublico.fotoUrl ? (
              <Image source={{ uri: usuarioPublico.fotoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarVazio]}>
                <Text style={styles.avatarTexto}>{usuarioPublico.nome.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.nome}>{usuarioPublico.nome}</Text>
            <Text style={styles.userName}>@{usuarioPublico.userName}</Text>
            {!!usuarioPublico.bio && <Text style={styles.bio}>{usuarioPublico.bio}</Text>}

            <View style={styles.estatisticas}>
              <View style={styles.estatisticaItem}>
                <Text style={styles.estatisticaNumero}>{postagens.length}</Text>
                <Text style={styles.estatisticaLabel}>Avistamentos</Text>
              </View>
              <View style={styles.estatisticaItem}>
                <Text style={styles.estatisticaNumero}>{especiesDistintas.size}</Text>
                <Text style={styles.estatisticaLabel}>Espécies</Text>
              </View>
              <View style={styles.estatisticaItem}>
                <Text style={styles.estatisticaNumero}>{usuarioPublico.totalSeguidores}</Text>
                <Text style={styles.estatisticaLabel}>Seguidores</Text>
              </View>
              <View style={styles.estatisticaItem}>
                <Text style={styles.estatisticaNumero}>{usuarioPublico.totalSeguindo}</Text>
                <Text style={styles.estatisticaLabel}>Seguindo</Text>
              </View>
            </View>

            {!ehOProprioUsuario && (
              <View style={styles.linhaAcoes}>
                <TouchableOpacity
                  style={[styles.botaoSeguir, usuarioPublico.seguindoPeloUsuario && styles.botaoSeguindo]}
                  onPress={handleAlternarSeguir}
                  disabled={alternandoSeguir}
                >
                  {alternandoSeguir ? (
                    <ActivityIndicator color={usuarioPublico.seguindoPeloUsuario ? colors.primary : colors.surface} />
                  ) : (
                    <Text
                      style={[
                        styles.botaoSeguirTexto,
                        usuarioPublico.seguindoPeloUsuario && styles.botaoSeguindoTexto,
                      ]}
                    >
                      {usuarioPublico.seguindoPeloUsuario ? 'Seguindo' : 'Seguir'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.botaoMensagem} onPress={handleAbrirChat} disabled={abrindoChat}>
                  {abrindoChat ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.botaoMensagemTexto}>Mensagem</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.secaoTitulo}>Avistamentos</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>Nenhum avistamento publicado ainda.</Text>
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
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  avatarVazio: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '700',
  },
  nome: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  userName: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  estatisticas: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 16,
  },
  estatisticaItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  estatisticaNumero: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  estatisticaLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  linhaAcoes: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  botaoSeguir: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoSeguindo: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  botaoSeguirTexto: {
    color: colors.surface,
    fontWeight: '600',
  },
  botaoSeguindoTexto: {
    color: colors.primary,
  },
  botaoMensagem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoMensagemTexto: {
    color: colors.text,
    fontWeight: '600',
  },
  secaoTitulo: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 20,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
});
