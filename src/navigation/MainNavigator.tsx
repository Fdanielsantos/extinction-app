import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text } from 'react-native';

import ChatScreen from '../screens/ChatScreen';
import ConversasScreen from '../screens/ConversasScreen';
import EditarPerfilScreen from '../screens/EditarPerfilScreen';
import EncyclopediaScreen from '../screens/EncyclopediaScreen';
import FeedScreen from '../screens/FeedScreen';
import MapScreen from '../screens/MapScreen';
import NewSightingScreen from '../screens/NewSightingScreen';
import NovoGrupoScreen from '../screens/NovoGrupoScreen';
import PerfilUsuarioScreen from '../screens/PerfilUsuarioScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SeguidoresScreen from '../screens/SeguidoresScreen';
import { colors } from '../theme/colors';
import { MainStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

// Ícones simples em emoji para manter o esqueleto livre de dependências extras
// (trocar por @expo/vector-icons quando o design visual for definido).
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Feed: '🏠',
  Mapa: '🗺️',
  NovoAvistamento: '📷',
  Enciclopedia: '📖',
  Conversas: '💬',
  Perfil: '👤',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Feed: 'Feed',
  Mapa: 'Mapa',
  NovoAvistamento: 'Avistar',
  Enciclopedia: 'Espécies',
  Conversas: 'Chat',
  Perfil: 'Perfil',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, color }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="NovoAvistamento" component={NewSightingScreen} />
      <Tab.Screen name="Enciclopedia" component={EncyclopediaScreen} />
      <Tab.Screen name="Conversas" component={ConversasScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Stack por cima das abas — permite empilhar telas (perfil de outro usuário,
// busca de "Seguidores", edição de perfil, chat) sobre qualquer aba, mantendo
// a barra de abas como navegação principal.
export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PerfilUsuario" component={PerfilUsuarioScreen} options={{ title: 'Perfil' }} />
      <Stack.Screen name="Seguidores" component={SeguidoresScreen} options={{ title: 'Seguidores' }} />
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar perfil' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="NovoGrupo" component={NovoGrupoScreen} options={{ title: 'Novo grupo' }} />
    </Stack.Navigator>
  );
}
