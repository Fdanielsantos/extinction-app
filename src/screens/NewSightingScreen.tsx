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

import StatusBadge from '../components/StatusBadge';
import { classificarImagemMock, criarPostagem } from '../services/mockApi';
import { colors } from '../theme/colors';
import { PredicaoEspecie } from '../types';

type EtapaClassificacao = 'ociosa' | 'classificando' | 'concluida';

export default function NewSightingScreen() {
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [coordenadas, setCoordenadas] = useState<{ latitude: number; longitude: number } | null>(null);
  const [etapa, setEtapa] = useState<EtapaClassificacao>('ociosa');
  const [predicoes, setPredicoes] = useState<PredicaoEspecie[]>([]);
  const [especieSelecionadaId, setEspecieSelecionadaId] = useState<number | null>(null);
  const [legenda, setLegenda] = useState('');
  const [publicando, setPublicando] = useState(false);

  const resetar = () => {
    setFotoUri(null);
    setCoordenadas(null);
    setEtapa('ociosa');
    setPredicoes([]);
    setEspecieSelecionadaId(null);
    setLegenda('');
  };

  const processarFoto = async (uri: string) => {
    setFotoUri(uri);
    setEtapa('classificando');
    setPredicoes([]);
    setEspecieSelecionadaId(null);

    // RF002 / RF016: captura automática de coordenadas no momento do avistamento.
    const permissaoLocalizacao = await Location.requestForegroundPermissionsAsync();
    if (permissaoLocalizacao.status === 'granted') {
      try {
        const posicao = await Location.getCurrentPositionAsync({});
        setCoordenadas({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude });
      } catch {
        // Cenário 4.4 (HU04): localização inválida/indisponível — segue sem coordenadas.
      }
    }

    // RF001 / RF018: reconhecimento de espécie via ML (mock — substituir pela API real depois).
    const resultado = await classificarImagemMock(uri);
    setPredicoes(resultado);
    if (resultado.length > 0) setEspecieSelecionadaId(resultado[0].especie.id);
    setEtapa('concluida');
  };

  const escolherDaGaleria = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para selecionar uma foto.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      await processarFoto(resultado.assets[0].uri);
    }
  };

  const tirarFoto = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para tirar uma foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!resultado.canceled && resultado.assets[0]) {
      await processarFoto(resultado.assets[0].uri);
    }
  };

  const publicar = async () => {
    // Cenário 4.3 (HU04): publicação sem título/espécie da postagem.
    if (!fotoUri) {
      Alert.alert('Selecione uma foto', 'Escolha ou tire uma foto do avistamento antes de publicar.');
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
        fotoUri,
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Novo avistamento</Text>

      {fotoUri ? (
        <Image source={{ uri: fotoUri }} style={styles.foto} />
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
            Resultado do reconhecimento automático (mock — RF018 chamará o backend real).
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
  foto: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.border,
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
