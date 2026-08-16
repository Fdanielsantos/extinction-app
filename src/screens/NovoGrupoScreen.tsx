import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainStackParamList } from '../navigation/types';
import { criarGrupo, fetchUsuarios } from '../services/api';
import { colors } from '../theme/colors';
import { UsuarioPublico } from '../types';

type Navegacao = NativeStackNavigationProp<MainStackParamList>;

// RF: chats em grupo — escolher nome e participantes pra criar uma conversa em grupo.
export default function NovoGrupoScreen() {
  const navigation = useNavigation<Navegacao>();
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [nome, setNome] = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    fetchUsuarios()
      .then(setUsuarios)
      .finally(() => setCarregando(false));
  }, []);

  const alternarSelecao = (id: number) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const criar = async () => {
    if (!nome.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome pro grupo.');
      return;
    }
    if (selecionados.size < 1) {
      Alert.alert('Selecione participantes', 'Escolha ao menos mais um participante pro grupo.');
      return;
    }
    setCriando(true);
    try {
      const conversa = await criarGrupo(nome.trim(), Array.from(selecionados));
      navigation.replace('Chat', { conversaId: conversa.id, nomeExibicao: conversa.nomeExibicao });
    } finally {
      setCriando(false);
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
      <View style={styles.formulario}>
        <Text style={styles.label}>Nome do grupo</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex.: Trilha do Cerrado" />
        <Text style={styles.label}>Participantes ({selecionados.size} selecionado(s))</Text>
      </View>

      <FlatList
        data={usuarios}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const selecionado = selecionados.has(item.id);
          return (
            <TouchableOpacity style={styles.linha} onPress={() => alternarSelecao(item.id)}>
              <View style={[styles.checkbox, selecionado && styles.checkboxMarcado]}>
                {selecionado && <Text style={styles.checkboxTexto}>✓</Text>}
              </View>
              <Text style={styles.nomeUsuario}>{item.nome}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTexto}>Nenhum outro usuário cadastrado ainda.</Text>
          </View>
        }
      />

      <View style={styles.rodape}>
        <TouchableOpacity style={[styles.botaoCriar, criando && styles.botaoDesabilitado]} onPress={criar} disabled={criando}>
          {criando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoCriarTexto}>Criar grupo</Text>
          )}
        </TouchableOpacity>
      </View>
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
  formulario: {
    padding: 16,
    paddingBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMarcado: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTexto: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  nomeUsuario: {
    color: colors.text,
    fontWeight: '500',
  },
  vazio: {
    alignItems: 'center',
    paddingTop: 40,
  },
  vazioTexto: {
    color: colors.textMuted,
  },
  rodape: {
    padding: 16,
  },
  botaoCriar: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoCriarTexto: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});
