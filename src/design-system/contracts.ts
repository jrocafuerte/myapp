/**
 * CONTRATO DEL DESIGN SYSTEM
 * ---------------------------------------------------------------------------
 * Esta es la ÚNICA API de componentes de la que depende la app. Cualquier
 * librería (la incluida en adapters/default o la tuya) debe implementar estos
 * componentes con estas props. `index.ts` lo verifica en tiempo de compilación:
 * si tu adaptador no cumple el contrato, `npm run typecheck` falla y te dice qué falta.
 *
 * Reglas del contrato:
 *  - Los estilos se expresan con TOKENS (variant, tone, gap, padding…), nunca con
 *    números o colores sueltos. Así cada librería los traduce a su propio sistema.
 *  - Los íconos se piden por nombre (IconName). El adaptador decide cómo dibujarlos.
 */
import type React from 'react';
import type { ColorToken } from './theme';
import type {
  ElevationToken, FontWeightToken, IconSizeToken, LetterSpacingToken, RadiusToken, SpacingToken, TypographyToken,
} from './tokens';

/** Nombres de íconos (glifos de Ionicons). Un adaptador puede mapearlos a su propio set. */
export type IconName = string;

/** Tonos de color permitidos para textos e íconos. */
export type Tone = 'default' | 'muted' | 'primary' | 'success' | 'danger' | 'warning' | 'inverse' | 'onHero' | 'onPrimary' | 'highlight';

export interface TextProps {
  children: React.ReactNode;
  variant?: TypographyToken; // por defecto 'body'
  tone?: Tone;
  weight?: FontWeightToken;
  align?: 'left' | 'center' | 'right';
  mono?: boolean;
  letterSpacing?: LetterSpacingToken;
  selectable?: boolean;
  numberOfLines?: number;
  flex?: boolean; // ocupa el espacio restante en un Inline
}

export interface IconProps { name: IconName; size?: IconSizeToken; tone?: Tone; accessibilityLabel?: string }

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
}
export interface ConfirmButtonProps extends Omit<ButtonProps, 'onPress'> { onConfirm: () => void; confirmText?: string }

export interface IconButtonProps { icon: IconName; onPress: () => void; accessibilityLabel: string; tone?: Tone; badge?: number }

export interface InputProps {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address' | 'phone-pad' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'username' | 'password' | 'email' | 'off';
  autoFocus?: boolean;
  maxLength?: number;
  multiline?: boolean;
  editable?: boolean;
  returnKeyType?: 'done' | 'send' | 'go' | 'next';
  onSubmitEditing?: () => void;
}

export interface ChipOption<V> { label: string; value: V }
export interface ChipsProps<V extends string | number> { label?: string; options: ChipOption<V>[]; value: V | undefined; onChange: (v: V) => void }
/** Componente genérico: el tipo del valor se infiere de las opciones. */
export type ChipsComponent = <V extends string | number>(props: ChipsProps<V>) => React.ReactElement;

export interface ListItemProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: string;
  rightTone?: Tone;
  onPress?: () => void;
  danger?: boolean;
}

export interface ToggleRowProps { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }

/** Contenedores y layout */
interface BoxProps {
  children?: React.ReactNode;
  gap?: SpacingToken;
  padding?: SpacingToken;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  flex?: boolean;
  background?: ColorToken;
}
export type StackProps = BoxProps;
export interface InlineProps extends BoxProps { wrap?: boolean }
export interface CardProps { children: React.ReactNode; align?: 'start' | 'center'; padding?: SpacingToken }
export interface SurfaceProps extends BoxProps {
  background?: ColorToken | 'cardDebit' | 'cardCredit' | 'cardVirtual' | 'cardInactive';
  radius?: RadiusToken;
  bordered?: boolean;
  elevation?: ElevationToken;
  maxWidth?: `${number}%`;
  alignSelf?: 'start' | 'center' | 'end';
  aspectRatio?: number;
  accessibilityLabel?: string;
  onPress?: () => void;
}
export interface ScreenProps { children: React.ReactNode; scroll?: boolean; onTouchStart?: () => void }

/** Feedback y datos */
export interface BannerProps { kind: 'error' | 'success' | 'info'; text: string | null }
export interface EmptyStateProps { text: string; icon?: IconName }
export interface ProgressProps { value: number; tone?: 'primary' | 'success' | 'warning' | 'danger' }
export interface StatProps { label: string; value: string; tone?: Tone }
export interface KeyValueProps { k: string; v: string; selectable?: boolean }
export interface BarListProps { data: { label: string; value: number }[]; format?: (n: number) => string }
export interface ColumnChartProps { data: { label: string; values: number[] }[]; tones: ('primary' | 'success' | 'danger' | 'warning')[]; height?: number }
export interface BadgeProps { count: number }
export interface AvatarProps { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }
export interface SwatchProps { color: string; selected?: boolean; onPress: () => void; accessibilityLabel: string }
export interface SpinnerProps { tone?: Tone }

/** Lo que todo adaptador debe exportar. */
export interface DesignSystemComponents {
  Text: React.ComponentType<TextProps>;
  Icon: React.ComponentType<IconProps>;
  Button: React.ComponentType<ButtonProps>;
  ConfirmButton: React.ComponentType<ConfirmButtonProps>;
  IconButton: React.ComponentType<IconButtonProps>;
  Input: React.ComponentType<InputProps>;
  Chips: ChipsComponent;
  ListItem: React.ComponentType<ListItemProps>;
  ToggleRow: React.ComponentType<ToggleRowProps>;
  Stack: React.ComponentType<StackProps>;
  Inline: React.ComponentType<InlineProps>;
  Card: React.ComponentType<CardProps>;
  Surface: React.ComponentType<SurfaceProps>;
  Screen: React.ComponentType<ScreenProps>;
  Banner: React.ComponentType<BannerProps>;
  EmptyState: React.ComponentType<EmptyStateProps>;
  Progress: React.ComponentType<ProgressProps>;
  Stat: React.ComponentType<StatProps>;
  KeyValue: React.ComponentType<KeyValueProps>;
  BarList: React.ComponentType<BarListProps>;
  ColumnChart: React.ComponentType<ColumnChartProps>;
  Badge: React.ComponentType<BadgeProps>;
  Avatar: React.ComponentType<AvatarProps>;
  Swatch: React.ComponentType<SwatchProps>;
  Spinner: React.ComponentType<SpinnerProps>;
}
