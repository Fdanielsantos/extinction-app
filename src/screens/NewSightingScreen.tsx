import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LocationPickerModal from '../components/LocationPickerModal';
import StatusBadge from '../components/StatusBadge';
import { classificarImagem, criarPostagem } from '../services/api';
import { colors } from '../theme/colors';
import { PredicaoEspecie } from '../types';

type EtapaClassificacao = 'ociosa' | 'classificando' | 'concluida';

const LIMITE_FOTOS = 6;

export default function NewSightingScreen() {
  const [fotos, setFotos] = useState<string[]>([]);
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [etapa, setEtapa] = useState<EtapaClassificacao>('ociosa');
  const [predicoes, setPredicoes] = useState<PredicaoEspecie[]>([]);
  const [especieSelecionadaId, setEspecieSelecionadaId] = useState<number | null>(null);
  const [legenda, setLegenda] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [seletorLocalizacaoVisivel, setSeletorLocalizacaoVisivel] = useState(false);
  const [fotosDaGaleriaPendentes, setFotosDaGaleriaPendentes] = useState<string[]>([]);

  const resetar = () => {
    setFotos([]);
    setCoordenadas(null);
    setEtapa('ociosa');
    setPredicoes([]);
    setEspecieSelecionadaId(null);
    setLegenda('');
  };

  // A classificação automática (RF001/RF018) roda uma única vez, sobre a
  // primeira foto adicionada — fotos extras (tiradas depois ou escolhidas
  // junto) só entram na publicação, sem disparar nova inferência.
  const adicionarFotos = async (novasUris: string[]) => {
    const primeiraLeva = fotos.length === 0 && novasUris.length > 0;
    setFotos((atual) => [...atual, ...novasUris].slice(0, LIMITE_FOTOS));

    if (primeiraLeva) {
      setEtapa('classificando');
      setPredicoes([]);
      setEspecieSelecionadaId(null);
      try {
        const resultado = await classificarImagem(novasUris[0]);
        setPredicoes(resultado);
        if (resultado.length > 0) setEspecieSelecionadaId(resultado[0].especie.id);
      } catch (erro) {
        Alert.alert(
          'Falha ao identificar espécie',
          erro instanceof Error ? erro.message : 'Tente novamente.'
        );
      } finally {
        setEtapa('concluida');
      }
    }
  };

  const removerFoto = (indice: number) => {
    setFotos((atual) => atual.filter((_, i) => i !== indice));
  };

  const tirarFoto = async () => {
    if (fotos.length >= LIMITE_FOTOS) {
      Alert.alert('Limite de fotos', `Você pode adicionar até ${LIMITE_FOTOS} fotos por avistamento.`);
      return;
    }
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para tirar uma foto.');
      return;
    }

    const primeiraFoto = fotos.length === 0;
    // RF: "ajustar a foto" — crop nativo do picker (só funciona pra uma foto
    // por vez, por isso câmera e galeria multi-seleção tratam isso diferente).
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (resultado.canceled || !resultado.assets[0]) return;

    if (primeiraFoto) {
      // RF002 / RF016: captura automática de coordenadas no momento do avistamento
      // (faz sentido só pra foto tirada agora, na hora — não pra galeria).
      const permissaoLocalizacao = await Location.requestForegroundPermissionsAsync();
      if (permissaoLocalizacao.status === 'granted') {
        try {
          const posicao = await Location.getCurrentPositionAsync({});
          setCoordenadas({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude });
        } catch {
          // Cenário 4.4 (HU04): localização inválida/indisponível — segue sem coordenadas.
        }
      }
    }

    await adicionarFotos([resultado.assets[0].uri]);
  };

  const escolherDaGaleria = async () => {
    if (fotos.length >= LIMITE_FOTOS) {
      Alert.alert('Limite de fotos', `Você pode adicionar até ${LIMITE_FOTOS} fotos por avistamento.`);
      return;
    }
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para selecionar fotos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      // RF: múltiplas fotos por avistamento. allowsMultipleSelection e
      // allowsEditing são mutuamente exclusivos no picker — com mais de uma
      // foto não dá pra recortar, então o ajuste fica só pro fluxo da câmera.
      allowsMultipleSelection: true,
      selectionLimit: LIMITE_FOTOS - fotos.length,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;

    const uris = resultado.assets.map((asset) => asset.uri);
    if (fotos.length === 0) {
      // Fotos da galeria podem ter sido tiradas em outro lugar/hora — pede
      // pra confirmar/ajustar a localização manualmente em vez de assumir o GPS atual.
      setFotosDaGaleriaPendentes(uris);
      setSeletorLocalizacaoVisivel(true);
    } else {
      await adicionarFotos(uris);
    }
  };

  const confirmarLocalizacaoDaGaleria = async (coordenadasEscolhidas: { latitude: number; longitude: number }) => {
    setSeletorLocalizacaoVisivel(false);
    setCoordenadas(coordenadasEscolhidas);
    await adicionarFotos(fotosDaGaleriaPendentes);
    setFotosDaGaleriaPendentes([]);
  };

  const pularLocalizacaoDaGaleria = async () => {
    setSeletorLocalizacaoVisivel(false);
    await adicionarFotos(fotosDaGaleriaPendentes);
    setFotosDaGaleriaPendentes([]);
  };

  const publicar = async () => {
    // Cenário 4.3 (HU04): publicação sem título/espécie da postagem.
    if (fotos.length === 0) {
      Alert.alert('Selecione uma foto', 'Escolha ou tire ao menos uma foto do avistamento antes de publicar.');
      return;
    }
    const especieEscolhida = predicoes.find((p) => p.especie.id === especieSelecionadaId)?.especie;
    if (!especieEscolhida) {
      Alert.alert('Selecione a espécie', 'Confirme qual espécie identificada está correta.');
      return;
    }

    setPublicando(true);
    try {
      await criarPostagem({
        fotoUris: fotos,
        legenda: legenda.trim() || `Avistamento de ${especieEscolhida.nomePopular}`,
        especies: [especieEscolhida],
        latitude: coordenadas?.latitude,
        longitude: coordenadas?.longitude,
      });
      Alert.alert('Publicado!', 'Seu avistamento foi adicionado ao feed.');
      resetar();
    } finally {
      setPublicando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Novo avistamento</Text>

      {fotos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotosLista}>
          {fotos.map((uri, indice) => (
            <View key={`${uri}-${indice}`} style={styles.fotoMiniaturaContainer}>
              <Image source={{ uri }} style={styles.fotoMiniatura} />
              <TouchableOpacity style={styles.removerFotoBotao} onPress={() => removerFoto(indice)}>
                <Text style={styles.removerFotoTexto}>✕</Text>
              </TouchableOpacity>
              {indice === 0 && (
                <View style={styles.capaSelo}>
                  <Text style={styles.capaSeloTexto}>Capa</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.fotoVazia}>
          <Text style={styles.fotoVaziaTexto}>Nenhuma foto selecionada</Text>
        </View>
      )}

      <View style={styles.linhaBotoes}>
        <TouchableOpacity style={styles.botaoSecundario} onPress={tirarFoto}>
          <Text style={styles.botaoSecundarioTexto}>Tirar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.botaoSecundario} onPress={escolherDaGaleria}>
          <Text style={styles.botaoSecundarioTexto}>Escolher da galeria</Text>
        </TouchableOpacity>
      </View>
      {fotos.length > 0 && (
        <Text style={styles.contadorFotos}>{fotos.length}/{LIMITE_FOTOS} fotos</Text>
      )}

      <Text style={styles.localizacao}>
        {coordenadas
          ? `Localização capturada: ${coordenadas.latitude.toFixed(4)}, ${coordenadas.longitude.toFixed(4)}`
          : 'Localização ainda não capturada.'}
      </Text>

      {etapa === 'classificando' && (
        <View style={styles.classificando}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.classificandoTexto}>Identificando espécie...</Text>
        </View>
      )}

      {etapa === 'concluida' && predicoes.length > 0 && (
        <View style={styles.predicoes}>
          <Text style={styles.secaoTitulo}>Qual espécie é essa?</Text>
          <Text style={styles.secaoSubtitulo}>
            Resultado do reconhecimento automático de espécie.
          </Text>
          {predicoes.map(({ especie, confiancaPercentual }) => {
            const selecionada = especie.id === especieSelecionadaId;
            return (
              <TouchableOpacity
                key={especie.id}
                style={[styles.predicaoItem, selecionada && styles.predicaoItemSelecionada]}
                onPress={() => setEspecieSelecionadaId(especie.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.predicaoNome}>{especie.nomePopular}</Text>
                  <Text style={styles.predicaoCientifico}>{especie.nomeCientifico}</Text>
                  <StatusBadge status={especie.statusEspecieAtual} />
                </View>
                <Text style={styles.predicaoConfianca}>{confiancaPercentual}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {etapa === 'concluida' && predicoes.length === 0 && (
        <View style={styles.predicoes}>
          <Text style={styles.secaoTitulo}>Espécie não identificada</Text>
          <Text style={styles.secaoSubtitulo}>
            Não conseguimos reconhecer a espécie com confiança suficiente nessa foto.
          </Text>
        </View>
      )}

      <TextInput
        style={styles.legenda}
        placeholder="Escreva uma legenda para o avistamento..."
        value={legenda}
        onChangeText={setLegenda}
        multiline
      />

      <TouchableOpacity
        style={[styles.botaoPrimario, publicando && styles.botaoDesabilitado]}
        onPress={publicar}
        disabled={publicando}
      >
        {publicando ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.botaoPrimarioTexto}>Publicar avistamento</Text>
        )}
      </TouchableOpacity>
    </ScrollView>

    <LocationPickerModal
      visible={seletorLocalizacaoVisivel}
      onConfirmar={confirmarLocalizacaoDaGaleria}
      onPular={pularLocalizacaoDaGaleria}
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  fotosLista: {
    gap: 10,
  },
  fotoMiniaturaContainer: {
    position: 'relative',
  },
  fotoMiniatura: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  removerFotoBotao: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removerFotoTexto: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  capaSelo: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  capaSeloTexto: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '600',
  },
  fotoVazia: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoVaziaTexto: {
    color: colors.textMuted,
  },
  linhaBotoes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  botaoSecundario: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoSecundarioTexto: {
    color: colors.primary,
    fontWeight: '600',
  },
  contadorFotos: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  localizacao: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textMuted,
  },
  classificando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  classificandoTexto: {
    color: colors.textMuted,
  },
  predicoes: {
    marginTop: 16,
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  secaoSubtitulo: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 10,
  },
  predicaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  predicaoItemSelecionada: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}11`,
  },
  predicaoNome: {
    fontWeight: '700',
    color: colors.text,
  },
  predicaoCientifico: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginBottom: 4,
  },
  predicaoConfianca: {
    fontWeight: '700',
    color: colors.primary,
  },
  legenda: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 16,
  },
  botaoPrimario: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoPrimarioTexto: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});
