import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import StatusBadge from '../components/StatusBadge';
import { fetchEspecies } from '../services/mockApi';
import { colors } from '../theme/colors';
import { Especie } from '../types';

export default function EncyclopediaScreen() {
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [busca, setBusca] = useState('');
  const [expandidaId, setExpandidaId] = useState<number | null>(null);

  useEffect(() => {
    fetchEspecies().then(setEspecies);
  }, []);

  // Cenário 7.6/7.7 (HU07): busca/filtro de espécies e tratamento de "sem resultados".
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return especies;
    return especies.filter(
      (e) =>
        e.nomePopular.toLowerCase().includes(termo) ||
        e.nomeCientifico.toLowerCase().includes(termo),
    );
  }, [especies, busca]);

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>Enciclopédia</Text>
        <TextInput
          style={styles.busca}
          placeholder="Buscar espécie..."
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        renderItem={({ item }) => {
          const expandida = expandidaId === item.id;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setExpandidaId(expandida ? null : item.id)}
            >
              <View style={styles.cardCabecalho}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nomePopular}>{item.nomePopular}</Text>
                  <Text style={styles.nomeCientifico}>{item.nomeCientifico}</Text>
                </View>
                <StatusBadge status={item.statusEspecieAtual} />
              </View>
              {expandida && (
                <View style={styles.detalhes}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cabecalho: {
    padding: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  busca: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardCabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nomePopular: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  nomeCientifico: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginBottom: 6,
  },
  detalhes: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  detalhesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
  },
  detalhesTexto: {
    fontSize: 13,
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
