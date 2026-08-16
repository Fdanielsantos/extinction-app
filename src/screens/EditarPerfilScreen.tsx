import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
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

import { useAuth } from '../context/AuthContext';
import { atualizarPerfil } from '../services/api';
import { colors } from '../theme/colors';

// RF: gerenciamento de perfil — editar nome, bio e foto do próprio usuário.
export default function EditarPerfilScreen() {
  const navigation = useNavigation();
  const { usuario, atualizarUsuario } = useAuth();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [bio, setBio] = useState(usuario?.bio ?? '');
  const [novaFotoUri, setNovaFotoUri] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const fotoExibida = novaFotoUri ?? usuario?.fotoUrl;

  const escolherFoto = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para escolher uma foto de perfil.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setNovaFotoUri(resultado.assets[0].uri);
    }
  };

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Nome obrigatório', 'Informe seu nome antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      const usuarioAtualizado = await atualizarPerfil({
        nome: nome.trim(),
        bio: bio.trim(),
        fotoUri: novaFotoUri ?? undefined,
      });
      await atualizarUsuario(usuarioAtualizado);
      navigation.goBack();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <TouchableOpacity style={styles.avatarBotao} onPress={escolherFoto}>
          {fotoExibida ? (
            <Image source={{ uri: fotoExibida }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarVazio]}>
              <Text style={styles.avatarVazioTexto}>{nome.charAt(0) || '?'}</Text>
            </View>
          )}
          <Text style={styles.trocarFotoTexto}>Trocar foto</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Seu nome" />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.inputBio]}
          value={bio}
          onChangeText={setBio}
          placeholder="Fale um pouco sobre você..."
          multiline
        />

        <TouchableOpacity
          style={[styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.botaoSalvarTexto}>Salvar alterações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  avatarBotao: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarVazio: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarVazioTexto: {
    color: colors.surface,
    fontSize: 36,
    fontWeight: '700',
  },
  trocarFotoTexto: {
    marginTop: 8,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
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
    marginBottom: 18,
    color: colors.text,
  },
  inputBio: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  botaoSalvar: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  botaoSalvarTexto: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
});
