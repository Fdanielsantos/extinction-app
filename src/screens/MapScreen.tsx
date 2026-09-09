import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatusBadge from '../components/StatusBadge';
import { MainStackParamList } from '../navigation/types';
import { fetchFeed } from '../services/api';
import { colors } from '../theme/colors';
import { REGIAO_INICIAL_BRASIL } from '../theme/mapStyle';
import { Postagem, StatusEspecieAtual } from '../types';
import { construirHtmlMapaFeed } from '../utils/leafletMapHtml';

type Navegacao = NativeStackNavigationProp<MainStackParamList>;

// RF008 / HU05: filtro de mapa por espécie/nível de risco + busca por nome científico.
const FILTROS: { label: string; status: StatusEspecieAtual | 'TODAS' }[] = [
  { label: 'Todas', status: 'TODAS' },
  { label: 'Vulnerável', status: 'VULNERAVEL' },
  { label: 'Em perigo', status: 'EM_PERIGO' },
  { label: 'Criticamente em perigo', status: 'CRIATICAMENTE_EM_PERIGO' },
];

const HTML_MAPA = construirHtmlMapaFeed(REGIAO_INICIAL_BRASIL);

export default function MapScreen() {
  const navigation = useNavigation<Navegacao>();
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
        <TouchableOpacity
          style={styles.cartaoInfo}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('PerfilUsuario', { idUsuario: postagemSelecionada.idPerfil })
          }
        >
          <TouchableOpacity style={styles.fechar} onPress={() => setPostagemSelecionada(null)}>
            <Text style={styles.fecharTexto}>✕</Text>
          </TouchableOpacity>
          {postagemSelecionada.fotoUrls[0] && (
            <Image source={{ uri: postagemSelecionada.fotoUrls[0] }} style={styles.cartaoFoto} />
          )}
          <View style={styles.cartaoConteudo}>
            <Text style={styles.cartaoTitulo}>
              {postagemSelecionada.identificacaoPendente
                ? postagemSelecionada.sugestaoEspecieUsuario ?? 'Espécie não identificada'
                : postagemSelecionada.especies.map((e) => e.nomePopular).join(', ')}
            </Text>
            <Text style={styles.cartaoAutor}>por {postagemSelecionada.autorNome}</Text>
            {!!postagemSelecionada.legenda && (
              <Text style={styles.cartaoLegenda} numberOfLines={2}>
                {postagemSelecionada.legenda}
              </Text>
            )}
            <View style={styles.cartaoRodape}>
              {postagemSelecionada.especies[0] && (
                <StatusBadge status={postagemSelecionada.especies[0].statusEspecieAtual} />
              )}
              <Text style={styles.cartaoMetrica}>♥ {postagemSelecionada.curtidas}</Text>
              <Text style={styles.cartaoMetrica}>
                {postagemSelecionada.comentarios.length} comentário(s)
              </Text>
            </View>
          </View>
        </TouchableOpacity>
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
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cartaoFoto: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  cartaoConteudo: {
    flex: 1,
    gap: 3,
  },
  fechar: {
    position: 'absolute',
    top: 8,
    right: 10,
    padding: 4,
    zIndex: 1,
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
  cartaoLegenda: {
    fontSize: 12,
    color: colors.text,
  },
  cartaoRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  cartaoMetrica: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
