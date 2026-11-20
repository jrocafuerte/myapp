import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useBank } from '../store/BankContext';
import type { BankState, Currency } from '../store/types';
import { money } from '../utils/format';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { colors, touch } = useBank();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }} onTouchStart={touch}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
      keyboardShouldPersistTaps="handled" onTouchStart={touch}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useBank();
  return <View style={[{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 }, style]}>{children}</View>;
}

export function T({ children, size = 15, weight = '400', color, muted, center, style, selectable }: {
  children: React.ReactNode; size?: number; weight?: '400' | '500' | '600' | '700' | '800'; color?: string; muted?: boolean;
  center?: boolean; style?: object; selectable?: boolean;
}) {
  const { colors } = useBank();
  return (
    <Text selectable={selectable} style={[{ fontSize: size, fontWeight: weight, color: color ?? (muted ? colors.muted : colors.text), textAlign: center ? 'center' : 'left' }, style]}>
      {children}
    </Text>
  );
}

export const H = ({ children }: { children: React.ReactNode }) => <T size={17} weight="700">{children}</T>;

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, small }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName; disabled?: boolean; loading?: boolean; small?: boolean;
}) {
  const { colors } = useBank();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, danger: colors.danger, ghost: 'transparent' }[variant];
  const fg = { primary: colors.primaryText, secondary: colors.primary, danger: '#fff', ghost: colors.primary }[variant];
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => ({ backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderRadius: 12,
        paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 12 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        alignSelf: small ? 'flex-start' : 'stretch' })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, hint, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const { colors } = useBank();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T size={13} weight="600" muted>{label}</T> : null}
      <TextInput placeholderTextColor={colors.muted} {...props}
        style={[{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 16, color: colors.text },
          props.multiline ? { minHeight: 90, textAlignVertical: 'top' } : null, props.style]} />
      {hint ? <T size={12} muted>{hint}</T> : null}
    </View>
  );
}

export function Chips<V extends string | number>({ label, options, value, onChange }: {
  label?: string; options: { label: string; value: V }[]; value: V | undefined; onChange: (v: V) => void;
}) {
  const { colors } = useBank();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T size={13} weight="600" muted>{label}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityState={{ selected: active }}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
                borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }}>
              <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AccountPicker({ label = 'Cuenta', value, onChange, currency, exclude }: {
  label?: string; value: string | undefined; onChange: (id: string) => void; currency?: Currency; exclude?: string;
}) {
  const { state } = useBank();
  const opts = state.accounts.filter((a) => !a.closed && (!currency || a.currency === currency) && a.id !== exclude)
    .map((a) => ({ label: `${a.alias} · ${money(a.balance, a.currency, { hidden: state.settings.hideBalances })}`, value: a.id }));
  return <Chips label={label} options={opts} value={value} onChange={onChange} />;
}

export function Row({ icon, title, subtitle, right, rightColor, onPress, danger }: {
  icon?: IconName; title: string; subtitle?: string; right?: string; rightColor?: string; onPress?: () => void; danger?: boolean;
}) {
  const { colors } = useBank();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      {icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? colors.dangerSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T weight="600" color={danger ? colors.danger : undefined}>{title}</T>
        {subtitle ? <T size={12} muted>{subtitle}</T> : null}
      </View>
      {right ? <T weight="700" color={rightColor}>{right}</T> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useBank();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <T weight="600">{title}</T>
        {subtitle ? <T size={12} muted>{subtitle}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const { colors } = useBank();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

export function Banner({ kind, text }: { kind: 'error' | 'success' | 'info'; text: string | null }) {
  const { colors } = useBank();
  if (!text) return null;
  const c = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.primary;
  const icon: IconName = kind === 'error' ? 'alert-circle' : kind === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c, backgroundColor: colors.card }}>
      <Ionicons name={icon} size={18} color={c} />
      <T size={14} color={c} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

export function Empty({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  const { colors } = useBank();
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <T muted center>{text}</T>
    </View>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T size={12} muted>{label}</T>
      <T size={16} weight="700" color={color}>{value}</T>
    </View>
  );
}

export function KV({ k, v, selectable }: { k: string; v: string; selectable?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <T muted>{k}</T>
      <T weight="600" selectable={selectable} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
    </View>
  );
}

export function Bars({ data, format = (n: number) => n.toFixed(0) }: { data: { label: string; value: number; color?: string }[]; format?: (n: number) => string }) {
  const { colors } = useBank();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13}>{d.label}</T><T size={13} weight="700">{format(d.value)}</T>
          </View>
          <View style={{ height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' }}>
            <View style={{ width: `${(d.value / max) * 100}%`, height: '100%', backgroundColor: d.color ?? colors.primary, borderRadius: 5 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Hook para ejecutar operaciones del banco mostrando error/éxito. */
export function useAction() {
  const { run } = useBank();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const exec = (op: (s: BankState) => BankState, okMsg: string, validate?: () => string | null) => {
    setSuccess(null);
    const v = validate?.();
    if (v) { setError(v); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); return false; }
    const err = run(op);
    setError(err);
    if (!err) { setSuccess(okMsg); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    return !err;
  };
  const feedback = (<><Banner kind="error" text={error} /><Banner kind="success" text={success} /></>);
  return { exec, feedback, setError, setSuccess };
}

export const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 10, alignItems: 'center' } });

/** Botón con doble confirmación (funciona igual en iOS, Android y web). */
export function ConfirmButton(props: Omit<React.ComponentProps<typeof Button>, 'onPress'> & { onConfirm: () => void; confirmText?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button {...props} title={armed ? props.confirmText ?? 'Tocá de nuevo para confirmar' : props.title}
      variant={armed ? 'danger' : props.variant}
      onPress={() => { if (armed) { setArmed(false); props.onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }} />
  );
}
