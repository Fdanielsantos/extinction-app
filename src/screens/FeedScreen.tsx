import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostCard from '../components/PostCard';
import { adicionarComentario, fetchFeed, toggleCurtida } from '../services/api';
import { colors } from '../theme/colors';
import { Postagem } from '../types';

export default function FeedScreen() {
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const primeiraCarga = useRef(true);

  const carregar = useCallback(async () => {
    const dados = await fetchFeed();
    setPostagens(dados);
  }, []);

  // Recarrega toda vez que a aba ganha foco (ex.: voltando de "Novo avistamento"
  // depois de publicar), não só na primeira montagem.
  useFocusEffect(
    useCallback(() => {
      if (primeiraCarga.current) {
        carregar().finally(() => {
          setCarregando(false);
          primeiraCarga.current = false;
        });
      } else {
        carregar();
      }
    }, [carregar]),
  );

  const handleAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const handleCurtir = async (id: number) => {
    // Atualização otimista, revertida depois pela chamada real (RF005 / HU06).
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

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.vazio}>
          <Text style={styles.vazioTexto}>Carregando feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        style={styles.lista}
        data={postagens}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard postagem={item} onCurtir={handleCurtir} onComentar={handleComentar} />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={handleAtualizar} />}
        ListHeaderComponent={
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Feed de avistamentos</Text>
            <Text style={styles.subtitulo}>Descobertas recentes da comunidade</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>Nenhum avistamento por aqui ainda.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  lista: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cabecalho: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitulo: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
});
