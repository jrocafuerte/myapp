/**
 * Capa de UI de la APP (no del design system).
 * Reexporta todo el design system y agrega piezas que conocen el dominio bancario
 * (selector de cuentas, ejecución de operaciones con feedback, pantalla con control de inactividad).
 * Las pantallas importan desde aquí; el design system se reemplaza en src/design-system/index.ts.
 */
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Banner, Chips, Screen as DSScreen, type ScreenProps } from '../design-system';
import { useBank } from '../store/BankContext';
import type { BankState, Currency } from '../store/types';
import { money } from '../utils/format';

export * from '../design-system';

/** Pantalla estándar: registra actividad para el cierre automático de sesión. */
export function Screen(props: Omit<ScreenProps, 'onTouchStart'>) {
  const { touch } = useBank();
  return <DSScreen {...props} onTouchStart={touch} />;
}

export function AccountPicker({ label = 'Cuenta', value, onChange, currency, exclude }: {
  label?: string; value: string | undefined; onChange: (id: string) => void; currency?: Currency; exclude?: string;
}) {
  const { state } = useBank();
  const opts = state.accounts.filter((a) => !a.closed && (!currency || a.currency === currency) && a.id !== exclude)
    .map((a) => ({ label: `${a.alias} · ${money(a.balance, a.currency, { hidden: state.settings.hideBalances })}`, value: a.id }));
  return <Chips label={label} options={opts} value={value} onChange={onChange} />;
}

/** Ejecuta operaciones del banco mostrando error/éxito con Banner y vibración. */
export function useAction() {
  const { run } = useBank();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const exec = (op: (s: BankState) => BankState, okMsg: string, validate?: () => string | null) => {
    setSuccess(null);
    const v = validate?.();
    const err = v ?? run(op);
    setError(err);
    if (!err) setSuccess(okMsg);
    Haptics.notificationAsync(err ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    return !err;
  };
  const feedback = (<><Banner kind="error" text={error} /><Banner kind="success" text={success} /></>);
  return { exec, feedback, setError, setSuccess };
}
