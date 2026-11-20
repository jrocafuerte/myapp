/**
 * ADAPTADOR POR DEFECTO — implementación del contrato con React Native puro,
 * @expo/vector-icons y expo-haptics. Para usar tu propia librería, creá otro
 * adaptador con los mismos exports (ver src/design-system/README.md).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text as RNText, TextInput, View, type ViewStyle } from 'react-native';
import type * as C from '../../contracts';
import { useTheme, type Colors, type Theme } from '../../theme';

/* ------------------------------- utilidades ------------------------------ */
const toneColor = (c: Colors, tone: C.Tone = 'default') => ({
  default: c.text, muted: c.muted, primary: c.primary, success: c.success, danger: c.danger,
  warning: c.warning, inverse: c.inverse, onHero: c.heroText, onPrimary: c.primaryText, highlight: c.highlight,
}[tone]);
const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;
const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;
const box = (t: Theme, p: C.StackProps): ViewStyle => ({
  gap: p.gap ? t.spacing[p.gap] : undefined,
  padding: p.padding ? t.spacing[p.padding] : undefined,
  alignItems: p.align ? alignMap[p.align] : undefined,
  justifyContent: p.justify ? justifyMap[p.justify] : undefined,
  flex: p.flex ? 1 : undefined,
  backgroundColor: p.background ? t.colors[p.background] : undefined,
  ...(p.overlay ? { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } : null),
});
const tap = () => Haptics.selectionAsync().catch(() => {});

/* --------------------------------- texto --------------------------------- */
export function Text({ children, variant = 'body', tone, weight, align, mono, letterSpacing, selectable, numberOfLines, flex }: C.TextProps) {
  const t = useTheme();
  return (
    <RNText selectable={selectable} numberOfLines={numberOfLines}
      style={[t.typography[variant], {
        color: toneColor(t.colors, tone), textAlign: align, flex: flex ? 1 : undefined, flexShrink: 1,
        fontWeight: weight ? t.fontWeight[weight] : t.typography[variant].fontWeight,
        fontFamily: mono ? t.fontFamily.mono : t.fontFamily.sans,
        letterSpacing: letterSpacing ? t.letterSpacing[letterSpacing] : undefined,
      }]}>
      {children}
    </RNText>
  );
}

export function Icon({ name, size = 'md', tone = 'default', accessibilityLabel }: C.IconProps) {
  const t = useTheme();
  return <Ionicons name={name as React.ComponentProps<typeof Ionicons>['name']} size={t.iconSize[size]} color={toneColor(t.colors, tone)}
    accessibilityLabel={accessibilityLabel} accessibilityElementsHidden={!accessibilityLabel} />;
}

export function Spinner({ tone = 'primary' }: C.SpinnerProps) {
  const t = useTheme();
  return <ActivityIndicator color={toneColor(t.colors, tone)} />;
}

/* -------------------------------- acciones ------------------------------- */
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, small, accessibilityLabel }: C.ButtonProps) {
  const t = useTheme(); const c = t.colors;
  const bg = { primary: c.primary, secondary: c.primarySoft, danger: c.danger, ghost: 'transparent' }[variant];
  const fg = { primary: c.primaryText, secondary: c.primary, danger: c.inverse, ghost: c.primary }[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => ({
        backgroundColor: bg, opacity: disabled ? t.opacity.disabled : pressed ? t.opacity.pressed : 1, borderRadius: t.radius.md,
        minHeight: small ? undefined : t.sizing.touchTarget, paddingVertical: small ? t.spacing.sm : t.spacing.md,
        paddingHorizontal: small ? t.spacing.md : t.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: t.spacing.sm, alignSelf: small ? 'flex-start' : 'stretch',
      })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon as never} size={small ? t.iconSize.sm : t.iconSize.md} color={fg} /> : null}
      <RNText style={[small ? t.typography.bodySmall : t.typography.body, { color: fg, fontWeight: t.fontWeight.bold }]}>{title}</RNText>
    </Pressable>
  );
}

export function ConfirmButton(props: C.ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  return (
    <Button {...props} title={armed ? props.confirmText ?? 'Tocá de nuevo para confirmar' : props.title} variant={armed ? 'danger' : props.variant}
      onPress={() => { if (armed) { setArmed(false); props.onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }} />
  );
}

export function IconButton({ icon, onPress, accessibilityLabel, tone = 'default', badge }: C.IconButtonProps) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={t.spacing.sm}
      style={({ pressed }) => ({ minWidth: t.sizing.touchTarget, minHeight: t.sizing.touchTarget, alignItems: 'center', justifyContent: 'center', opacity: pressed ? t.opacity.pressed : 1 })}>
      <View>
        <Icon name={icon} size="lg" tone={tone} />
        {badge ? <View style={{ position: 'absolute', right: -t.spacing.xs, top: -t.spacing.xs }}><Badge count={badge} /></View> : null}
      </View>
    </Pressable>
  );
}

/* --------------------------------- inputs -------------------------------- */
export function Input({ label, hint, multiline, ...props }: C.InputProps) {
  const t = useTheme(); const c = t.colors;
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <Text variant="bodySmall" weight="semibold" tone="muted">{label}</Text> : null}
      <TextInput placeholderTextColor={c.muted} accessibilityLabel={label ?? props.placeholder} multiline={multiline} {...props}
        style={[t.typography.bodyLarge, { backgroundColor: c.input, borderWidth: t.borderWidth.hairline, borderColor: c.border, borderRadius: t.radius.md,
          padding: t.spacing.md, color: c.text, minHeight: multiline ? 90 : t.sizing.touchTarget, textAlignVertical: multiline ? 'top' : 'center' }]} />
      {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
}

export const Chips: C.ChipsComponent = ({ label, options, value, onChange }) => {
  const t = useTheme(); const c = t.colors;
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <Text variant="bodySmall" weight="semibold" tone="muted">{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: active }}
              style={{ paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, borderRadius: t.radius.pill, borderWidth: t.borderWidth.hairline,
                borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.card }}>
              <Text variant="bodySmall" tone={active ? 'primary' : 'default'} weight={active ? 'bold' : 'medium'}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export function ToggleRow({ title, subtitle, value, onChange }: C.ToggleRowProps) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.sizing.touchTarget }}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold">{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: t.colors.primary, false: t.colors.border }} />
    </View>
  );
}

/* ---------------------------------- listas ------------------------------- */
export function ListItem({ icon, title, subtitle, right, rightTone, onPress, danger }: C.ListItemProps) {
  const t = useTheme(); const c = t.colors;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.sm, minHeight: t.sizing.touchTarget, opacity: pressed ? t.opacity.pressed : 1 })}>
      {icon ? (
        <View style={{ width: t.sizing.avatarSm, height: t.sizing.avatarSm, borderRadius: t.radius.md, backgroundColor: danger ? c.dangerSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size="md" tone={danger ? 'danger' : 'primary'} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text weight="semibold" tone={danger ? 'danger' : 'default'}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted">{subtitle}</Text> : null}
      </View>
      {right ? <Text weight="bold" tone={rightTone}>{right}</Text> : null}
      {onPress ? <Icon name="chevron-forward" size="sm" tone="muted" /> : null}
    </Pressable>
  );
}

/* --------------------------------- layout -------------------------------- */
export function Stack({ children, ...p }: C.StackProps) {
  const t = useTheme();
  return <View style={box(t, p)}>{children}</View>;
}

export function Inline({ children, wrap, ...p }: C.InlineProps) {
  const t = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap' }, box(t, p)]}>{children}</View>;
}

export function Card({ children, align = 'start', padding = 'lg' }: C.CardProps) {
  const t = useTheme(); const c = t.colors;
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: t.radius.lg, padding: t.spacing[padding], borderWidth: t.borderWidth.hairline, borderColor: c.border,
      gap: t.spacing.md, alignItems: align === 'center' ? 'center' : undefined }, t.elevation.sm]}>
      {children}
    </View>
  );
}

export function Surface({ children, radius = 'md', bordered, elevation = 'none', maxWidth, alignSelf, aspectRatio, accessibilityLabel, onPress, ...p }: C.SurfaceProps) {
  const t = useTheme();
  const style: ViewStyle = {
    ...box(t, p), borderRadius: t.radius[radius], borderWidth: bordered ? t.borderWidth.hairline : 0, borderColor: t.colors.border,
    maxWidth, alignSelf: alignSelf ? alignMap[alignSelf] : undefined, aspectRatio, ...t.elevation[elevation],
  };
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? t.opacity.pressed : 1 }]}>{children}</Pressable>;
  return <View accessibilityLabel={accessibilityLabel} style={style}>{children}</View>;
}

export function Screen({ children, scroll = true, onTouchStart }: C.ScreenProps) {
  const t = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} onTouchStart={onTouchStart}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} keyboardShouldPersistTaps="handled" onTouchStart={onTouchStart}
      contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xxxl + t.spacing.lg, gap: t.spacing.md }}>
      {children}
    </ScrollView>
  );
}

/* ------------------------------ feedback/datos --------------------------- */
export function Banner({ kind, text }: C.BannerProps) {
  const t = useTheme();
  if (!text) return null;
  const tone: C.Tone = kind === 'error' ? 'danger' : kind === 'success' ? 'success' : 'primary';
  const icon = kind === 'error' ? 'alert-circle' : kind === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole={kind === 'error' ? 'alert' : undefined}
      style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center', padding: t.spacing.md, borderRadius: t.radius.md, borderWidth: t.borderWidth.hairline,
        borderColor: toneColor(t.colors, tone), backgroundColor: t.colors.card }}>
      <Icon name={icon} size="md" tone={tone} />
      <Text variant="bodySmall" tone={tone} flex>{text}</Text>
    </View>
  );
}

export function EmptyState({ text, icon = 'file-tray-outline' }: C.EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: t.spacing.xxl, gap: t.spacing.sm }}>
      <Icon name={icon} size="xl" tone="muted" />
      <Text tone="muted" align="center">{text}</Text>
    </View>
  );
}

export function Progress({ value, tone = 'primary' }: C.ProgressProps) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height: t.sizing.progress, backgroundColor: t.colors.border, borderRadius: t.radius.xs, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: t.colors[tone] }} />
    </View>
  );
}

export function Stat({ label, value, tone }: C.StatProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: t.spacing.xxs }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <Text variant="bodyLarge" weight="bold" tone={tone}>{value}</Text>
    </View>
  );
}

export function KeyValue({ k, v, selectable }: C.KeyValueProps) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md }}>
      <Text tone="muted">{k}</Text>
      <Text weight="semibold" selectable={selectable} align="right" flex>{v}</Text>
    </View>
  );
}

export function BarList({ data, format = (n) => n.toFixed(0) }: C.BarListProps) {
  const t = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: t.spacing.md }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: t.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodySmall">{d.label}</Text><Text variant="bodySmall" weight="bold">{format(d.value)}</Text>
          </View>
          <View style={{ height: t.sizing.barThick, backgroundColor: t.colors.border, borderRadius: t.radius.xs, overflow: 'hidden' }}>
            <View style={{ width: `${(d.value / max) * 100}%`, height: '100%', backgroundColor: t.colors.primary, borderRadius: t.radius.xs }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ColumnChart({ data, tones, height = 130 }: C.ColumnChartProps) {
  const t = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm, height: height + t.spacing.xxl + t.spacing.xs }}>
      {data.map((d) => (
        <View key={d.label} style={{ flex: 1, alignItems: 'center', gap: t.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.xxs, height }}>
            {d.values.map((v, i) => <View key={i} style={{ width: t.sizing.barThick, height: (v / max) * height, backgroundColor: t.colors[tones[i] ?? 'primary'], borderRadius: t.radius.xs }} />)}
          </View>
          <Text variant="micro" tone="muted">{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Badge({ count }: C.BadgeProps) {
  const t = useTheme();
  if (!count) return null;
  return (
    <View style={{ backgroundColor: t.colors.danger, borderRadius: t.radius.sm, minWidth: t.sizing.iconSm, paddingHorizontal: t.spacing.xxs, alignItems: 'center' }}>
      <Text variant="micro" tone="inverse" weight="bold">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export function Avatar({ initials, color, size = 'md' }: C.AvatarProps) {
  const t = useTheme();
  const px = { sm: t.sizing.avatarSm, md: t.sizing.avatarMd, lg: t.sizing.avatarLg }[size];
  return (
    <View accessibilityLabel={`Avatar ${initials}`} style={{ width: px, height: px, borderRadius: px / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant={size === 'lg' ? 'title' : size === 'md' ? 'heading' : 'bodySmall'} tone="inverse" weight="heavy">{initials}</Text>
    </View>
  );
}

export function Swatch({ color, selected, onPress, accessibilityLabel }: C.SwatchProps) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} hitSlop={t.spacing.sm}
      style={{ width: t.sizing.swatch, height: t.sizing.swatch, borderRadius: t.sizing.swatch / 2, backgroundColor: color,
        borderWidth: selected ? t.borderWidth.thick : 0, borderColor: t.colors.text }} />
  );
}
