import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
}

export default function PostCard({ postagem, onCurtir }: Props) {
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
          <Text style={styles.acaoTexto}>{postagem.comentarios.length} comentário(s)</Text>
        </View>
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
});
