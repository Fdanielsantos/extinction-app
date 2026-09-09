import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { MainStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { Localidade, Postagem } from '../types';
import StatusBadge from './StatusBadge';

type Navegacao = NativeStackNavigationProp<MainStackParamList>;

const LARGURA_TELA = Dimensions.get('window').width;

function Avatar({ nome, fotoUrl, tamanho }: { nome: string; fotoUrl?: string; tamanho: number }) {
  if (fotoUrl) {
    return (
      <Image
        source={{ uri: fotoUrl }}
        style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatar,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2 },
      ]}
    >
      <Text style={[styles.avatarTexto, { fontSize: tamanho * 0.45 }]}>{nome.charAt(0)}</Text>
    </View>
  );
}

function formatarDataRelativa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / (1000 * 60));
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

// Cidade nem sempre vem preenchida (posts antigos, ou geocoding reverso sem
// resultado) -- cai pras coordenadas cruas em vez de esconder a localização
// que a pessoa efetivamente selecionou ao publicar.
function formatarLocalidade(localidade?: Localidade): string {
  if (!localidade) return 'Localização não informada';
  if (localidade.cidade) {
    return localidade.estado ? `${localidade.cidade}, ${localidade.estado}` : localidade.cidade;
  }
  return `${localidade.latitude.toFixed(3)}, ${localidade.longitude.toFixed(3)}`;
}

interface Props {
  postagem: Postagem;
  onCurtir: (id: number) => void;
  onComentar: (id: number, descricao: string) => Promise<void>;
  onExcluir: (id: number) => Promise<void>;
  onEditarComentario: (postagemId: number, comentarioId: number, descricao: string) => Promise<void>;
  onExcluirComentario: (postagemId: number, comentarioId: number) => Promise<void>;
}

const LARGURA_CARTAO = LARGURA_TELA - 32; // card tem marginHorizontal: 16 dos dois lados

export default function PostCard({
  postagem,
  onCurtir,
  onComentar,
  onExcluir,
  onEditarComentario,
  onExcluirComentario,
}: Props) {
  const navigation = useNavigation<Navegacao>();
  const { usuario } = useAuth();
  const [comentariosVisiveis, setComentariosVisiveis] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fotoAtual, setFotoAtual] = useState(0);
  const [excluindo, setExcluindo] = useState(false);
  const [comentarioEmEdicaoId, setComentarioEmEdicaoId] = useState<number | null>(null);
  const [textoEdicaoComentario, setTextoEdicaoComentario] = useState('');
  const [salvandoEdicaoComentario, setSalvandoEdicaoComentario] = useState(false);

  const ehAutor = usuario?.id === postagem.idPerfil;

  const handleExcluir = () => {
    Alert.alert(
      'Excluir publicação',
      'Tem certeza que deseja excluir este avistamento? Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setExcluindo(true);
            try {
              await onExcluir(postagem.id);
            } catch (erro) {
              Alert.alert(
                'Não foi possível excluir',
                erro instanceof Error ? erro.message : 'Tente novamente em instantes.'
              );
              setExcluindo(false);
            }
          },
        },
      ]
    );
  };

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

  const iniciarEdicaoComentario = (comentarioId: number, descricaoAtual: string) => {
    setComentarioEmEdicaoId(comentarioId);
    setTextoEdicaoComentario(descricaoAtual);
  };

  const cancelarEdicaoComentario = () => {
    setComentarioEmEdicaoId(null);
    setTextoEdicaoComentario('');
  };

  const salvarEdicaoComentario = async () => {
    const descricao = textoEdicaoComentario.trim();
    if (!descricao || comentarioEmEdicaoId == null) return;
    setSalvandoEdicaoComentario(true);
    try {
      await onEditarComentario(postagem.id, comentarioEmEdicaoId, descricao);
      cancelarEdicaoComentario();
    } catch (erro) {
      Alert.alert(
        'Não foi possível salvar',
        erro instanceof Error ? erro.message : 'Tente novamente em instantes.'
      );
    } finally {
      setSalvandoEdicaoComentario(false);
    }
  };

  const handleExcluirComentario = (comentarioId: number) => {
    Alert.alert('Excluir comentário', 'Tem certeza que deseja excluir este comentário?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await onExcluirComentario(postagem.id, comentarioId);
          } catch (erro) {
            Alert.alert(
              'Não foi possível excluir',
              erro instanceof Error ? erro.message : 'Tente novamente em instantes.'
            );
          }
        },
      },
    ]);
  };

  const handleScrollFotos = (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    const indice = Math.round(evento.nativeEvent.contentOffset.x / LARGURA_CARTAO);
    setFotoAtual(indice);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        <TouchableOpacity
          style={styles.cabecalhoInfo}
          onPress={() => navigation.navigate('PerfilUsuario', { idUsuario: postagem.idPerfil })}
        >
          <Avatar nome={postagem.autorNome} fotoUrl={postagem.autorFotoUrl} tamanho={36} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.autor}>{postagem.autorNome}</Text>
            <Text style={styles.local}>
              {formatarLocalidade(postagem.localidade)} · {formatarDataRelativa(postagem.data)}
            </Text>
          </View>
        </TouchableOpacity>
        {ehAutor && (
          <TouchableOpacity style={styles.excluirBotao} onPress={handleExcluir} disabled={excluindo}>
            {excluindo ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <Text style={styles.excluirTexto}>🗑</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={postagem.fotoUrls}
        keyExtractor={(uri, indice) => `${postagem.id}-${indice}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollFotos}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={[styles.foto, { width: LARGURA_CARTAO }]} />
        )}
      />
      {postagem.fotoUrls.length > 1 && (
        <View style={styles.pontosFoto}>
          {postagem.fotoUrls.map((_, indice) => (
            <View key={indice} style={[styles.ponto, indice === fotoAtual && styles.pontoAtivo]} />
          ))}
        </View>
      )}

      <View style={styles.corpo}>
        {postagem.identificacaoPendente ? (
          <>
            <View style={styles.sugestaoBadge}>
              <Text style={styles.sugestaoBadgeTexto}>Sugestão do usuário · não confirmada</Text>
            </View>
            {postagem.sugestaoEspecieUsuario && (
              <Text style={styles.especieNome}>{postagem.sugestaoEspecieUsuario}</Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.especies}>
              {postagem.especies.map((especie) => (
                <StatusBadge key={especie.id} status={especie.statusEspecieAtual} />
              ))}
            </View>
            <Text style={styles.especieNome}>
              {postagem.especies.map((e) => e.nomePopular).join(', ')}
            </Text>
          </>
        )}
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
              postagem.comentarios.map((comentario) => {
                const ehAutorDoComentario = usuario?.id === comentario.idPerfil;
                const podeExcluir = ehAutorDoComentario || ehAutor;
                const emEdicao = comentarioEmEdicaoId === comentario.id;

                if (emEdicao) {
                  return (
                    <View key={comentario.id} style={styles.comentarioItem}>
                      <Text style={styles.comentarioAutor}>{comentario.autorNome}</Text>
                      <TextInput
                        style={styles.comentarioInputEdicao}
                        value={textoEdicaoComentario}
                        onChangeText={setTextoEdicaoComentario}
                        editable={!salvandoEdicaoComentario}
                        autoFocus
                        multiline
                      />
                      <View style={styles.comentarioEdicaoAcoes}>
                        <TouchableOpacity onPress={cancelarEdicaoComentario} disabled={salvandoEdicaoComentario}>
                          <Text style={styles.comentarioAcaoTexto}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={salvarEdicaoComentario}
                          disabled={salvandoEdicaoComentario || !textoEdicaoComentario.trim()}
                        >
                          {salvandoEdicaoComentario ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                          ) : (
                            <Text style={[styles.comentarioAcaoTexto, styles.comentarioAcaoTextoDestaque]}>
                              Salvar
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={comentario.id} style={styles.comentarioItem}>
                    <Text style={styles.comentarioAutor}>{comentario.autorNome}</Text>
                    <Text style={styles.comentarioTexto}>{comentario.descricao}</Text>
                    {(ehAutorDoComentario || podeExcluir) && (
                      <View style={styles.comentarioEdicaoAcoes}>
                        {ehAutorDoComentario && (
                          <TouchableOpacity onPress={() => iniciarEdicaoComentario(comentario.id, comentario.descricao)}>
                            <Text style={styles.comentarioAcaoTexto}>Editar</Text>
                          </TouchableOpacity>
                        )}
                        {podeExcluir && (
                          <TouchableOpacity onPress={() => handleExcluirComentario(comentario.id)}>
                            <Text style={styles.comentarioAcaoTexto}>Excluir</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
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
  cabecalhoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  excluirBotao: {
    padding: 8,
  },
  excluirTexto: {
    fontSize: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 220,
    backgroundColor: colors.border,
  },
  pontosFoto: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  pontoAtivo: {
    backgroundColor: colors.primary,
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
  sugestaoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.accent}22`,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  sugestaoBadgeTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
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
  comentarioInputEdicao: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  comentarioEdicaoAcoes: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  comentarioAcaoTexto: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  comentarioAcaoTextoDestaque: {
    color: colors.primary,
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
