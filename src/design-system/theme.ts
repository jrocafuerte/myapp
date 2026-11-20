/**
 * TEMA SEMÁNTICO — asigna roles (fondo, texto, primario…) a colores de la paleta.
 * Las pantallas solo conocen roles; así el modo oscuro y el cambio de marca son triviales.
 */
import React, { createContext, useContext } from 'react';
import { borderWidth, elevation, fontFamily, fontWeight, iconSize, letterSpacing, opacity, palette as p, radius, sizing, spacing, typography } from './tokens';

const light = {
  bg: p.gray50, card: p.white, text: p.gray900, muted: p.gray600, border: p.gray200,
  primary: p.blue700, primaryText: p.white, primarySoft: p.blue50,
  success: p.green600, danger: p.red600, dangerSoft: p.red50, warning: p.amber600, input: p.gray25,
  hero: p.navy700, heroText: p.blue100, inverse: p.white, highlight: p.amber200,
  cardDebit: p.blue700, cardCredit: p.navy600, cardVirtual: p.blue500, cardInactive: p.gray600,
};
/** Roles de color: las claves son el contrato; los valores, la marca. */
export type Colors = { [K in keyof typeof light]: string };
export const lightColors: Colors = light;
export type ColorToken = keyof Colors;

export const darkColors: Colors = {
  bg: p.navy950, card: p.navy850, text: p.gray100, muted: p.gray400, border: p.borderDark,
  primary: p.blue300, primaryText: p.navy950, primarySoft: p.blueDark,
  success: p.green400, danger: p.red400, dangerSoft: p.redDark, warning: p.amber400, input: p.navy900,
  hero: p.navy800, heroText: p.blue200, inverse: p.white, highlight: p.amber200,
  cardDebit: p.blue700, cardCredit: p.navy600, cardVirtual: p.blue500, cardInactive: p.gray500,
};

const base = { spacing, radius, typography, fontWeight, fontFamily, letterSpacing, sizing, iconSize, borderWidth, opacity, elevation };
export interface Theme extends Readonly<typeof base> { colors: Colors; dark: boolean }
export const createTheme = (dark: boolean): Theme => ({ ...base, colors: dark ? darkColors : lightColors, dark });

const ThemeContext = createContext<Theme>(createTheme(false));

/** Provee el tema a todo el árbol. La app decide `dark` (preferencia del usuario o del sistema). */
export function DesignSystemProvider({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const theme = React.useMemo(() => createTheme(dark), [dark]);
  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export const useTheme = () => useContext(ThemeContext);
