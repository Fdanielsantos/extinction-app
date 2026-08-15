import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { Postagem } from '../types';
import StatusBadge from './StatusBadge';

function formatarDataRelativa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  if (horas < 1) return 'agora há pouco';
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

interface Props {
  postagem: Postagem;
  onCurtir: (id: number) => void;
  onComentar: (id: number, descricao: string) => Promise<void>;
}

export default function PostCard({ postagem, onCurtir, onComentar }: Props) {
  const [comentariosVisiveis, setComentariosVisiveis] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleEnviarComentario = async () => {
    const descricao = novoComentario.trim();
    if (!descricao) return;
    setEnviando(true);
    try {
      await onComentar(postagem.id, descricao);
      setNovoComentario('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{postagem.autorNome.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.autor}>{postagem.autorNome}</Text>
          <Text style={styles.local}>
            {postagem.localidade?.cidade ?? 'Localização não informada'} · {formatarDataRelativa(postagem.data)}
          </Text>
        </View>
      </View>

      <Image source={{ uri: postagem.fotoUrl }} style={styles.foto} />

      <View style={styles.corpo}>
        <View style={styles.especies}>
          {postagem.especies.map((especie) => (
            <StatusBadge key={especie.id} status={especie.statusEspecieAtual} />
          ))}
        </View>
        <Text style={styles.especieNome}>
          {postagem.especies.map((e) => e.nomePopular).join(', ')}
        </Text>
        <Text style={styles.legenda}>{postagem.legenda}</Text>

        <View style={styles.acoes}>
          <TouchableOpacity style={styles.acaoCurtir} onPress={() => onCurtir(postagem.id)}>
            <Text style={[styles.coracao, postagem.curtidoPeloUsuario && styles.coracaoAtivo]}>
              {postagem.curtidoPeloUsuario ? '♥' : '♡'}
            </Text>
            <Text style={styles.acaoTexto}>{postagem.curtidas}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setComentariosVisiveis((v) => !v)}>
            <Text style={styles.acaoTexto}>
              {postagem.comentarios.length} comentário(s) {comentariosVisiveis ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {comentariosVisiveis && (
          <View style={styles.comentarios}>
            {postagem.comentarios.length === 0 ? (
              <Text style={styles.comentarioVazio}>Nenhum comentário ainda. Seja o primeiro!</Text>
            ) : (
              postagem.comentarios.map((comentario) => (
                <View key={comentario.id} style={styles.comentarioItem}>
                  <Text style={styles.comentarioAutor}>{comentario.autorNome}</Text>
                  <Text style={styles.comentarioTexto}>{comentario.descricao}</Text>
                </View>
              ))
            )}

            <View style={styles.comentarioLinha}>
              <TextInput
                style={styles.comentarioInput}
                placeholder="Escreva um comentário..."
                value={novoComentario}
                onChangeText={setNovoComentario}
                editable={!enviando}
              />
              <TouchableOpacity
                style={[styles.comentarioBotao, (enviando || !novoComentario.trim()) && styles.botaoDesabilitado]}
                onPress={handleEnviarComentario}
                disabled={enviando || !novoComentario.trim()}
              >
                {enviando ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Text style={styles.comentarioBotaoTexto}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarTexto: {
    color: colors.surface,
    fontWeight: '700',
  },
  autor: {
    fontWeight: '600',
    color: colors.text,
  },
  local: {
    fontSize: 12,
    color: colors.textMuted,
  },
  foto: {
    width: '100%',
    height: 220,
    backgroundColor: colors.border,
  },
  corpo: {
    padding: 12,
  },
  especies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  especieNome: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  legenda: {
    color: colors.text,
    marginBottom: 10,
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  acaoCurtir: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coracao: {
    fontSize: 20,
    color: colors.textMuted,
    marginRight: 4,
  },
  coracaoAtivo: {
    color: colors.danger,
  },
  acaoTexto: {
    color: colors.textMuted,
    fontSize: 13,
  },
  comentarios: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  comentarioVazio: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  comentarioItem: {
    marginBottom: 8,
  },
  comentarioAutor: {
    fontWeight: '600',
    color: colors.text,
    fontSize: 13,
  },
  comentarioTexto: {
    color: colors.text,
    fontSize: 13,
  },
  comentarioLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  comentarioInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  comentarioBotao: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  botaoDesabilitado: {
    opacity: 0.5,
  },
  comentarioBotaoTexto: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 13,
  },
});
