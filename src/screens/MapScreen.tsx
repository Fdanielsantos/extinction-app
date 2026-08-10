import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { fetchFeed } from '../services/mockApi';
import { colors, statusLabels } from '../theme/colors';
import { Postagem, StatusEspecieAtual } from '../types';

// RF008 / HU05: filtro de mapa por espécie/nível de risco + busca por nome científico.
const FILTROS: { label: string; status: StatusEspecieAtual | 'TODAS' }[] = [
  { label: 'Todas', status: 'TODAS' },
  { label: 'Vulnerável', status: 'VULNERAVEL' },
  { label: 'Em perigo', status: 'EM_PERIGO' },
  { label: 'Criticamente em perigo', status: 'CRIATICAMENTE_EM_PERIGO' },
];

const REGIAO_INICIAL = {
  latitude: -15.7801,
  longitude: -47.9292,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

export default function MapScreen() {
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusEspecieAtual | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    fetchFeed().then(setPostagens);
  }, []);

  const marcadores = useMemo(() => {
    return postagens.filter((postagem) => {
      if (!postagem.localidade) return false;
      const especies = postagem.especies;
      const passaStatus =
        filtroStatus === 'TODAS' || especies.some((e) => e.statusEspecieAtual === filtroStatus);
      const termo = busca.trim().toLowerCase();
      const passaBusca =
        termo.length === 0 ||
        especies.some(
          (e) =>
            e.nomeCientifico.toLowerCase().includes(termo) ||
            e.nomePopular.toLowerCase().includes(termo),
        );
      return passaStatus && passaBusca;
    });
  }, [postagens, filtroStatus, busca]);

  return (
    <View style={styles.container}>
      <View style={styles.filtros}>
        <TextInput
          style={styles.busca}
          placeholder="Buscar por nome científico ou popular"
          value={busca}
          onChangeText={setBusca}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTROS.map((filtro) => {
            const ativo = filtro.status === filtroStatus;
            return (
              <TouchableOpacity
                key={filtro.status}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setFiltroStatus(filtro.status)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{filtro.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <MapView style={styles.mapa} initialRegion={REGIAO_INICIAL}>
        {/*
          Tiles do OpenStreetMap (decisão já tomada em HU05), em vez do provider padrão
          Google/Apple Maps — evita depender de chave de API paga.
        */}
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        {marcadores.map((postagem) => (
          <Marker
            key={postagem.id}
            coordinate={{
              latitude: postagem.localidade!.latitude,
              longitude: postagem.localidade!.longitude,
            }}
            title={postagem.especies.map((e) => e.nomePopular).join(', ')}
            description={`${statusLabels[postagem.especies[0]?.statusEspecieAtual] ?? ''} · por ${postagem.autorNome}`}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filtros: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 10,
    paddingBottom: 8,
  },
  busca: {
    marginHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  chips: {
    paddingHorizontal: 16,
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
  mapa: {
    flex: 1,
  },
});
