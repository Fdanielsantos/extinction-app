import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';

import EncyclopediaScreen from '../screens/EncyclopediaScreen';
import FeedScreen from '../screens/FeedScreen';
import MapScreen from '../screens/MapScreen';
import NewSightingScreen from '../screens/NewSightingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme/colors';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Ícones simples em emoji para manter o esqueleto livre de dependências extras
// (trocar por @expo/vector-icons quando o design visual for definido).
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Feed: '🏠',
  Mapa: '🗺️',
  NovoAvistamento: '📷',
  Enciclopedia: '📖',
  Perfil: '👤',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Feed: 'Feed',
  Mapa: 'Mapa',
  NovoAvistamento: 'Avistar',
  Enciclopedia: 'Espécies',
  Perfil: 'Perfil',
};

export default function MainNavigator() {
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
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
