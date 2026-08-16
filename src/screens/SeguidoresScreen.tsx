import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainStackParamList } from '../navigation/types';
import { alternarSeguir, fetchUsuarios } from '../services/api';
import { colors } from '../theme/colors';
import { UsuarioPublico } from '../types';

type Navegacao = NativeStackNavigationProp<MainStackParamList>;

// RF: seguir outros usuários — busca/listagem de todos os usuários do app,
// com botão de seguir/deixar de seguir direto na lista.
export default function SeguidoresScreen() {
  const navigation = useNavigation<Navegacao>();
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alternandoId, setAlternandoId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUsuarios()
        .then(setUsuarios)
        .finally(() => setCarregando(false));
    }, []),
  );

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) => u.nome.toLowerCase().includes(termo) || u.userName.toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  const handleAlternarSeguir = async (id: number) => {
    setAlternandoId(id);
    try {
      const atualizado = await alternarSeguir(id);
      setUsuarios((atual) => atual.map((u) => (u.id === id ? atualizado : u)));
    } finally {
      setAlternandoId(null);
    }
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.carregandoBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar usuário por nome..."
        value={busca}
        onChangeText={setBusca}
      />
      <FlatList
        data={usuariosFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.linha}
            onPress={() => navigation.navigate('PerfilUsuario', { idUsuario: item.id })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{item.nome.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.detalhe}>
                {item.totalSeguidores} seguidor(es) · @{item.userName}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.botaoSeguir, item.seguindoPeloUsuario && styles.botaoSeguindo]}
              onPress={() => handleAlternarSeguir(item.id)}
              disabled={alternandoId === item.id}
            >
              {alternandoId === item.id ? (
                <ActivityIndicator size="small" color={item.seguindoPeloUsuario ? colors.primary : colors.surface} />
              ) : (
                <Text style={[styles.botaoSeguirTexto, item.seguindoPeloUsuario && styles.botaoSeguindoTexto]}>
                  {item.seguindoPeloUsuario ? 'Seguindo' : 'Seguir'}
                </Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>
              {busca.trim() ? `Nenhum usuário encontrado para "${busca}".` : 'Nenhum outro usuário cadastrado ainda.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  carregandoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busca: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  nome: {
    fontWeight: '600',
    color: colors.text,
  },
  detalhe: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  botaoSeguir: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  botaoSeguindo: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  botaoSeguirTexto: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
  botaoSeguindoTexto: {
    color: colors.primary,
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 40,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
});
