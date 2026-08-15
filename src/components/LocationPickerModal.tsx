import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { REGIAO_INICIAL_BRASIL } from '../theme/mapStyle';
import { construirHtmlMapaSeletor } from '../utils/leafletMapHtml';

interface Coordenadas {
  latitude: number;
  longitude: number;
}

interface LocationPickerModalProps {
  visible: boolean;
  onConfirmar: (coordenadas: Coordenadas) => void;
  onPular: () => void;
}

// Usado ao publicar um avistamento a partir de uma foto da galeria: como a
// foto pode ter sido tirada em outro lugar/momento, o GPS atual do
// dispositivo não é uma localização confiável — deixa o usuário confirmar ou
// ajustar o pino manualmente antes de publicar.
export default function LocationPickerModal({ visible, onConfirmar, onPular }: LocationPickerModalProps) {
  const [pino, setPino] = useState<Coordenadas | null>(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const webviewRef = useRef<WebView>(null);

  const htmlMapa = useMemo(() => construirHtmlMapaSeletor(REGIAO_INICIAL_BRASIL), []);

  useEffect(() => {
    if (!visible) {
      setPino(null);
      setMapaPronto(false);
      return;
    }
    Location.requestForegroundPermissionsAsync().then(async (permissao) => {
      if (permissao.status !== 'granted') return;
      try {
        const posicao = await Location.getCurrentPositionAsync({});
        setPino({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude });
      } catch {
        // Sem GPS disponível — usuário posiciona o pino manualmente no mapa.
      }
    });
  }, [visible]);

  // Assim que o GPS resolve (ou muda por outro motivo) e o mapa já carregou,
  // desenha/recentraliza o pino dentro da WebView.
  useEffect(() => {
    if (!mapaPronto || !pino) return;
    webviewRef.current?.injectJavaScript(
      `window.definirPino(${pino.latitude}, ${pino.longitude}, true); true;`,
    );
  }, [mapaPronto, pino]);

  const handleMensagem = (evento: WebViewMessageEvent) => {
    const mensagem = JSON.parse(evento.nativeEvent.data);
    if (mensagem.tipo === 'pronto') {
      setMapaPronto(true);
    } else if (mensagem.tipo === 'pino') {
      setPino({ latitude: mensagem.latitude, longitude: mensagem.longitude });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onPular}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.cabecalho}>
          <Text style={styles.titulo}>Onde foi o avistamento?</Text>
          <Text style={styles.subtitulo}>
            Toque no mapa ou arraste o pino pra posicionar o local certo.
          </Text>
        </View>

        <WebView
          ref={webviewRef}
          style={styles.mapa}
          originWhitelist={['*']}
          source={{ html: htmlMapa }}
          onMessage={handleMensagem}
        />

        <View style={styles.rodape}>
          <TouchableOpacity style={styles.botaoSecundario} onPress={onPular}>
            <Text style={styles.botaoSecundarioTexto}>Pular localização</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.botaoPrimario, !pino && styles.botaoDesabilitado]}
            disabled={!pino}
            onPress={() => pino && onConfirmar(pino)}
          >
            <Text style={styles.botaoPrimarioTexto}>Usar esta localização</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  },
  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitulo: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  mapa: {
    flex: 1,
  },
  rodape: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  botaoSecundario: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoSecundarioTexto: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  botaoPrimario: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  botaoPrimarioTexto: {
    color: colors.surface,
    fontWeight: '600',
  },
});
