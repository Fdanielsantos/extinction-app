import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchEspecies, fetchFeed } from '../services/api';
import { colors } from '../theme/colors';
import { Especie, Postagem } from '../types';

// Fallback pra espécies antigas migradas de um banco já existente, sem valor
// de região preenchido (a coluna é nullable justamente por causa disso).
const REGIAO_PADRAO = 'Outras regiões';

// RF014 / HU07: Enciclopédia estilo Pokédex — espécies agrupadas por região
// (bioma), mostrando quais o próprio usuário já avistou (com foto real de um
// avistamento) e quais ainda não (silhueta bloqueada), com progresso geral.
export default function EncyclopediaScreen() {
  const { usuario } = useAuth();
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [busca, setBusca] = useState('');
  const [regiaoAtiva, setRegiaoAtiva] = useState('Todas');
  const [expandidaId, setExpandidaId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchEspecies().then(setEspecies);
      fetchFeed().then(setPostagens);
    }, []),
  );

  const especiesAvistadasPeloUsuario = useMemo(() => {
    if (!usuario) return new Set<number>();
    const idsAvistados = postagens
      .filter((p) => p.idPerfil === usuario.id)
      .flatMap((p) => p.especies.map((e) => e.id));
    return new Set(idsAvistados);
  }, [postagens, usuario]);

  const fotoPorEspecie = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const postagem of postagens) {
      const foto = postagem.fotoUrls[0];
      if (!foto) continue;
      for (const especie of postagem.especies) {
        if (!mapa.has(especie.id)) mapa.set(especie.id, foto);
      }
    }
    return mapa;
  }, [postagens]);

  const regioes = useMemo(() => {
    const distintas = Array.from(new Set(especies.map((e) => e.regiao || REGIAO_PADRAO))).sort();
    return ['Todas', ...distintas];
  }, [especies]);

  const especiesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return especies.filter((e) => {
      const passaRegiao = regiaoAtiva === 'Todas' || (e.regiao || REGIAO_PADRAO) === regiaoAtiva;
      const passaBusca =
        termo.length === 0 ||
        e.nomePopular.toLowerCase().includes(termo) ||
        e.nomeCientifico.toLowerCase().includes(termo);
      return passaRegiao && passaBusca;
    });
  }, [especies, busca, regiaoAtiva]);

  const totalAvistadas = especiesAvistadasPeloUsuario.size;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Pokédex das Espécies</Text>
        <View style={styles.progresso}>
          <Text style={styles.progressoTexto}>
            {totalAvistadas}/{especies.length} espécies avistadas por você
          </Text>
          <View style={styles.progressoBarraFundo}>
            <View
              style={[
                styles.progressoBarraPreenchida,
                { width: especies.length ? `${(totalAvistadas / especies.length) * 100}%` : '0%' },
              ]}
            />
          </View>
        </View>
        <TextInput
          style={styles.busca}
          placeholder="Buscar espécie..."
          value={busca}
          onChangeText={setBusca}
        />
        <FlatList
          horizontal
          data={regioes}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const ativo = item === regiaoAtiva;
            return (
              <TouchableOpacity
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setRegiaoAtiva(item)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={especiesFiltradas}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.linha}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        renderItem={({ item }) => {
          const avistada = especiesAvistadasPeloUsuario.has(item.id);
          const foto = fotoPorEspecie.get(item.id);
          const expandida = expandidaId === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, expandida && styles.cardExpandido]}
              onPress={() => setExpandidaId(expandida ? null : item.id)}
            >
              <View style={[styles.fotoContainer, !avistada && styles.fotoContainerBloqueada]}>
                {avistada && foto ? (
                  <Image source={{ uri: foto }} style={styles.foto} />
                ) : (
                  <Text style={styles.silhuetaTexto}>?</Text>
                )}
              </View>
              <Text style={styles.nomePopular} numberOfLines={1}>
                {avistada ? item.nomePopular : '??? não avistada'}
              </Text>
              <Text style={styles.nomeCientifico} numberOfLines={1}>
                {item.regiao || REGIAO_PADRAO}
              </Text>
              <StatusBadge status={item.statusEspecieAtual} />

              {expandida && (
                <View style={styles.detalhes}>
                  {!avistada && (
                    <Text style={styles.avisoBloqueado}>
                      Você ainda não publicou um avistamento dessa espécie.
                    </Text>
                  )}
                  <Text style={styles.detalhesLabel}>Nome científico</Text>
                  <Text style={styles.detalhesTexto}>{item.nomeCientifico}</Text>
                  <Text style={styles.detalhesLabel}>Habitat</Text>
                  <Text style={styles.detalhesTexto}>{item.habitat}</Text>
                  <Text style={styles.detalhesLabel}>Sobre</Text>
                  <Text style={styles.detalhesTexto}>{item.descricao}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>Nenhuma espécie encontrada para "{busca}".</Text>
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
  cabecalho: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  progresso: {
    marginBottom: 12,
  },
  progressoTexto: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  progressoBarraFundo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressoBarraPreenchida: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  busca: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  chips: {
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontSize: 13,
    color: colors.text,
  },
  chipTextoAtivo: {
    color: colors.surface,
    fontWeight: '600',
  },
  linha: {
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  cardExpandido: {
    borderColor: colors.primary,
  },
  fotoContainer: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  fotoContainerBloqueada: {
    backgroundColor: colors.border,
  },
  foto: {
    width: '100%',
    height: '100%',
  },
  silhuetaTexto: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textMuted,
  },
  nomePopular: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  nomeCientifico: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  detalhes: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  avisoBloqueado: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 6,
  },
  detalhesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  },
  detalhesTexto: {
    fontSize: 12,
    color: colors.text,
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 40,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
});
