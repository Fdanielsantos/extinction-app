import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { fetchFeed, fetchRanking } from '../services/api';
import { colors } from '../theme/colors';
import { RankingUsuario } from '../types';

export default function ProfileScreen() {
  const { usuario, logout } = useAuth();
  const [ranking, setRanking] = useState<RankingUsuario[]>([]);
  const [estatisticas, setEstatisticas] = useState({ avistamentos: 0, especiesCatalogadas: 0 });

  // Recarrega toda vez que a aba Perfil ganha foco (ex.: voltando de "Novo
  // avistamento" depois de publicar), não só na primeira montagem — mesmo
  // padrão já usado em FeedScreen/MapScreen pra manter os dados em dia.
  useFocusEffect(
    useCallback(() => {
      fetchRanking().then(setRanking);

      if (!usuario) return;
      fetchFeed().then((postagens) => {
        const doUsuario = postagens.filter((p) => p.idPerfil === usuario.id);
        const especiesDistintas = new Set(
          doUsuario.flatMap((p) => p.especies.map((e) => e.id)),
        );
        setEstatisticas({
          avistamentos: doUsuario.length,
          especiesCatalogadas: especiesDistintas.size,
        });
      });
    }, [usuario]),
  );

  if (!usuario) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={styles.cabecalho}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{usuario.nome.charAt(0)}</Text>
        </View>
        <Text style={styles.nome}>{usuario.nome}</Text>
        <Text style={styles.email}>{usuario.email}</Text>
      </View>

      <View style={styles.estatisticas}>
        <View style={styles.estatisticaItem}>
          <Text style={styles.estatisticaNumero}>{estatisticas.especiesCatalogadas}</Text>
          <Text style={styles.estatisticaLabel}>Espécies catalogadas</Text>
        </View>
        <View style={styles.estatisticaItem}>
          <Text style={styles.estatisticaNumero}>{estatisticas.avistamentos}</Text>
          <Text style={styles.estatisticaLabel}>Avistamentos validados</Text>
        </View>
      </View>

      <Text style={styles.secaoTitulo}>Ranking da comunidade</Text>
      {ranking.map((item, index) => (
        <View key={item.idPerfil} style={styles.rankingItem}>
          <Text style={styles.rankingPosicao}>{index + 1}º</Text>
          <Text style={styles.rankingNome}>{item.nome}</Text>
          <Text style={styles.rankingValor}>{item.totalAvistamentosValidados} avistamentos</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.botaoSair} onPress={logout}>
        <Text style={styles.botaoSairTexto}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cabecalho: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  email: {
    fontSize: 13,
    color: colors.textMuted,
  },
  estatisticas: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 24,
  },
  estatisticaItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  estatisticaNumero: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  estatisticaLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rankingPosicao: {
    fontWeight: '700',
    color: colors.primary,
    width: 32,
  },
  rankingNome: {
    flex: 1,
    color: colors.text,
  },
  rankingValor: {
    fontSize: 12,
    color: colors.textMuted,
  },
  botaoSair: {
    marginTop: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoSairTexto: {
    color: colors.danger,
    fontWeight: '600',
  },
});
