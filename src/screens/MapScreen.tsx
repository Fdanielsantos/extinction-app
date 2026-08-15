import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatusBadge from '../components/StatusBadge';
import { fetchFeed } from '../services/api';
import { colors } from '../theme/colors';
import { REGIAO_INICIAL_BRASIL } from '../theme/mapStyle';
import { Postagem, StatusEspecieAtual } from '../types';
import { construirHtmlMapaFeed } from '../utils/leafletMapHtml';

// RF008 / HU05: filtro de mapa por espécie/nível de risco + busca por nome científico.
const FILTROS: { label: string; status: StatusEspecieAtual | 'TODAS' }[] = [
  { label: 'Todas', status: 'TODAS' },
  { label: 'Vulnerável', status: 'VULNERAVEL' },
  { label: 'Em perigo', status: 'EM_PERIGO' },
  { label: 'Criticamente em perigo', status: 'CRIATICAMENTE_EM_PERIGO' },
];

const HTML_MAPA = construirHtmlMapaFeed(REGIAO_INICIAL_BRASIL);

export default function MapScreen() {
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusEspecieAtual | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [postagemSelecionada, setPostagemSelecionada] = useState<Postagem | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const webviewRef = useRef<WebView>(null);

  // Recarrega toda vez que a aba ganha foco, pra mostrar avistamentos recém-publicados.
  useFocusEffect(
    useCallback(() => {
      fetchFeed().then(setPostagens);
    }, []),
  );

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

  // Repassa os marcadores pro mapa (dentro da WebView) toda vez que a lista
  // filtrada muda — só depois que a página HTML sinalizou que carregou.
  useEffect(() => {
    if (!mapaPronto) return;
    const dados = marcadores.map((postagem) => ({
      id: postagem.id,
      latitude: postagem.localidade!.latitude,
      longitude: postagem.localidade!.longitude,
      cor: colors.statusColors[postagem.especies[0]?.statusEspecieAtual] ?? colors.primary,
    }));
    webviewRef.current?.injectJavaScript(
      `window.definirMarcadores(${JSON.stringify(dados)}); true;`,
    );
  }, [marcadores, mapaPronto]);

  const handleMensagem = (evento: WebViewMessageEvent) => {
    const mensagem = JSON.parse(evento.nativeEvent.data);
    if (mensagem.tipo === 'pronto') {
      setMapaPronto(true);
    } else if (mensagem.tipo === 'marcador') {
      const postagem = marcadores.find((p) => p.id === mensagem.id);
      if (postagem) setPostagemSelecionada(postagem);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      <WebView
        ref={webviewRef}
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html: HTML_MAPA }}
        onMessage={handleMensagem}
      />

      {postagemSelecionada && (
        <View style={styles.cartaoInfo}>
          <TouchableOpacity style={styles.fechar} onPress={() => setPostagemSelecionada(null)}>
            <Text style={styles.fecharTexto}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.cartaoTitulo}>
            {postagemSelecionada.especies.map((e) => e.nomePopular).join(', ')}
          </Text>
          <Text style={styles.cartaoAutor}>por {postagemSelecionada.autorNome}</Text>
          {postagemSelecionada.especies[0] && <StatusBadge status={postagemSelecionada.especies[0].statusEspecieAtual} />}
        </View>
      )}
    </SafeAreaView>
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
  cartaoInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fechar: {
    position: 'absolute',
    top: 8,
    right: 10,
    padding: 4,
  },
  fecharTexto: {
    color: colors.textMuted,
    fontSize: 16,
  },
  cartaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    paddingRight: 24,
  },
  cartaoAutor: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
