/**
 * TOKENS BASE — valores primitivos del design system.
 * La app nunca debe usar números o colores "sueltos": siempre un token de este archivo
 * (o un rol semántico de theme.ts). Si adoptás tu propia librería, reemplazá estos valores
 * por los de tu librería y la app entera se actualiza.
 */

/** Paleta cruda. No se usa directamente en pantallas: se mapea a roles en theme.ts. */
export const palette = {
  navy950: '#06101F', navy900: '#0A1628', navy850: '#0E1B30', navy800: '#001A3A', navy700: '#002B5C', navy600: '#001F42',
  blue700: '#0047AB', blue500: '#1A6FD1', blue300: '#5B9BEA', blue200: '#9DBCE3', blue100: '#B9D3F2', blue50: '#E6EEF9',
  blueDark: '#12284A', borderDark: '#1F3150',
  gray900: '#0B1B33', gray600: '#5B6B82', gray500: '#4A5970', gray400: '#93A3BA', gray200: '#DCE3EE', gray100: '#E3EAF4',
  gray50: '#F3F6FA', gray25: '#F7F9FC', white: '#FFFFFF', black: '#000000',
  green600: '#0B7D55', green400: '#3CCB91',
  red600: '#D0312D', red400: '#EE5A52', red50: '#FDE7E6', redDark: '#3A1A1A',
  amber600: '#A86400', amber400: '#F2B544', amber200: '#FDE68A',
} as const;

/** Colores que el usuario puede elegir para su avatar (contenido, no roles de UI). */
export const avatarColors = ['#0047AB', '#1A6FD1', '#0B7D55', '#A86400', '#D0312D', '#B4236B', '#6D3FC9', '#334155'] as const;

/** Escala de espaciado (base 4). */
export const spacing = { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export type SpacingToken = keyof typeof spacing;

/** Radios de borde. */
export const radius = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export type RadiusToken = keyof typeof radius;

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' } as const;
export type FontWeightToken = keyof typeof fontWeight;

export const fontFamily = { sans: undefined, mono: 'monospace' } as const;

export const letterSpacing = { normal: 0, wide: 2, code: 8 } as const;
export type LetterSpacingToken = keyof typeof letterSpacing;

/** Escala tipográfica: cada pantalla elige un nivel, nunca un tamaño. */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: fontWeight.heavy },
  title: { fontSize: 28, lineHeight: 34, fontWeight: fontWeight.heavy },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: fontWeight.bold },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold },
  bodyLarge: { fontSize: 16, lineHeight: 22, fontWeight: fontWeight.regular },
  body: { fontSize: 15, lineHeight: 21, fontWeight: fontWeight.regular },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.regular },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.regular },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.medium },
} as const;
export type TypographyToken = keyof typeof typography;

/** Tamaños de componentes. touchTarget sigue la guía de accesibilidad (mínimo 44pt). */
export const sizing = {
  touchTarget: 44, iconSm: 16, iconMd: 20, iconLg: 24, iconXl: 36,
  avatarSm: 36, avatarMd: 44, avatarLg: 80, tile: 48, swatch: 28, progress: 8, barThick: 10,
} as const;
export type IconSizeToken = 'sm' | 'md' | 'lg' | 'xl';
export const iconSize: Record<IconSizeToken, number> = { sm: sizing.iconSm, md: sizing.iconMd, lg: sizing.iconLg, xl: sizing.iconXl };

export const borderWidth = { none: 0, hairline: 1, thick: 3 } as const;

export const opacity = { pressed: 0.7, disabled: 0.45 } as const;

/** Elevación (sombra iOS + elevation Android). */
export const elevation = {
  none: {},
  sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
} as const;
export type ElevationToken = keyof typeof elevation;
