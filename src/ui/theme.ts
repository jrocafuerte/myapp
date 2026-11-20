/**
 * Paleta azul marino / azul cobalto. Los valores son aproximados: si contás con la guía de
 * marca oficial, reemplazá los códigos aquí y se aplican en toda la app.
 */
export const lightColors = {
  bg: '#F3F6FA', card: '#FFFFFF', text: '#0B1B33', muted: '#5B6B82', border: '#DCE3EE',
  primary: '#0047AB', primaryText: '#FFFFFF', primarySoft: '#E6EEF9',
  success: '#0E8A5F', danger: '#D0312D', dangerSoft: '#FDE7E6', warning: '#C77700', input: '#F7F9FC',
  hero: '#002B5C', heroText: '#B9D3F2',
  cardDebit: '#0047AB', cardCredit: '#001F42', cardVirtual: '#1F7AE0', cardInactive: '#5B6B82',
};
export const darkColors: typeof lightColors = {
  bg: '#06101F', card: '#0E1B30', text: '#E3EAF4', muted: '#93A3BA', border: '#1F3150',
  primary: '#5B9BEA', primaryText: '#06101F', primarySoft: '#12284A',
  success: '#3CCB91', danger: '#F2706B', dangerSoft: '#3A1A1A', warning: '#F2B544', input: '#0A1628',
  hero: '#001A3A', heroText: '#9DBCE3',
  cardDebit: '#0047AB', cardCredit: '#001F42', cardVirtual: '#1F7AE0', cardInactive: '#4A5970',
};
export type Colors = typeof lightColors;
