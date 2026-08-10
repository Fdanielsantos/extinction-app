import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, statusLabels } from '../theme/colors';
import { StatusEspecieAtual } from '../types';

export default function StatusBadge({ status }: { status: StatusEspecieAtual }) {
  const cor = colors.statusColors[status] ?? colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: `${cor}22`, borderColor: cor }]}>
      <View style={[styles.ponto, { backgroundColor: cor }]} />
      <Text style={[styles.texto, { color: cor }]}>{statusLabels[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
  },
});
