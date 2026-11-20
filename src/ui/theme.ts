export const lightColors = {
  bg: '#F4F6FB', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  primary: '#4F46E5', primaryText: '#FFFFFF', primarySoft: '#EEF2FF',
  success: '#059669', danger: '#DC2626', warning: '#D97706', input: '#F8FAFC', hero: '#312E81',
};
export const darkColors: typeof lightColors = {
  bg: '#0B1020', card: '#151B2E', text: '#E2E8F0', muted: '#94A3B8', border: '#26304A',
  primary: '#818CF8', primaryText: '#0B1020', primarySoft: '#1E2342',
  success: '#34D399', danger: '#F87171', warning: '#FBBF24', input: '#0F1527', hero: '#1E1B4B',
};
export type Colors = typeof lightColors;
