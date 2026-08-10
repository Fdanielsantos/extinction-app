export const colors = {
  background: '#F4F7F2',
  surface: '#FFFFFF',
  primary: '#1B5E3A',
  primaryDark: '#123D26',
  accent: '#E08A2C',
  text: '#1C1F1D',
  textMuted: '#6B7268',
  border: '#DDE3D9',
  danger: '#C0392B',
  statusColors: {
    POUCO_PREOCUPANTE: '#4C9A2A',
    QUASE_AMEACADA: '#A3B518',
    VULNERAVEL: '#E0B02C',
    EM_PERIGO: '#E08A2C',
    CRIATICAMENTE_EM_PERIGO: '#D9542F',
    EXTINTA_NA_NATUREZA: '#B23A48',
    EXTINTA: '#6B2737',
  } as const,
};

export const statusLabels: Record<string, string> = {
  POUCO_PREOCUPANTE: 'Pouco preocupante',
  QUASE_AMEACADA: 'Quase ameaçada',
  VULNERAVEL: 'Vulnerável',
  EM_PERIGO: 'Em perigo',
  CRIATICAMENTE_EM_PERIGO: 'Criticamente em perigo',
  EXTINTA_NA_NATUREZA: 'Extinta na natureza',
  EXTINTA: 'Extinta',
};
