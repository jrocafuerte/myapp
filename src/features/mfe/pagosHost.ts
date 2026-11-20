/**
 * Lado HOST del micro frontend de Pago de servicios, sin UI (testeable en Node).
 * Traduce el estado de la app a `HostContext` y ejecuta las operaciones pedidas
 * con la misma lógica de negocio que usan las pantallas nativas.
 */
import type { HostContext, Operation, Receipt, ThemeSnapshot } from '../../../shared/pagos-mfe/protocol';
import * as L from '../../store/logic';
import type { BankState } from '../../store/types';

export function buildContext(s: BankState, theme: ThemeSnapshot): HostContext {
  const alias = (id: string) => s.accounts.find((a) => a.id === id);
  return {
    locale: s.settings.language,
    hideBalances: s.settings.hideBalances,
    theme,
    accounts: s.accounts.filter((a) => !a.closed).map(({ id, alias: name, currency, balance, isPrimary }) => ({ id, alias: name, currency, balance, isPrimary })),
    services: s.services.map(({ id, company, type, customerNumber, amountDue, dueDate, autoDebit, autoDebitAccountId, reminder }) =>
      ({ id, company, type, customerNumber, amountDue, dueDate, autoDebit, autoDebitAccountId, reminder })),
    payments: s.transactions.filter((t) => t.type === 'payment').slice(0, 60).map((t) => ({
      id: t.id, date: t.date, description: t.description, amount: t.amount, reference: t.reference,
      currency: alias(t.accountId)?.currency ?? 'USD', accountAlias: alias(t.accountId)?.alias ?? '—',
    })),
  };
}

/** Ejecuta una operación. Lanza BankError con un mensaje para el usuario si no es válida. */
export function execute(s: BankState, op: Operation): { state: BankState; receipt?: Receipt } {
  switch (op.name) {
    case 'payService': {
      const srv = s.services.find((x) => x.id === op.serviceId);
      const state = L.payService(s, op.serviceId, op.accountId);
      const desc = `Pago ${srv?.type} - ${srv?.company}`;
      const before = new Set(s.transactions.map((t) => t.id));
      const tx = state.transactions.find((t) => t.description === desc && !before.has(t.id));
      const acc = state.accounts.find((a) => a.id === op.accountId)!;
      return { state, receipt: tx && { reference: tx.reference, description: tx.description, amount: -tx.amount, currency: acc.currency, date: tx.date, accountAlias: acc.alias } };
    }
    case 'addService': return { state: L.addService(s, op) };
    case 'removeService': return { state: L.removeService(s, op.serviceId) };
    case 'setAutoDebit': return { state: L.setAutoDebit(s, op.serviceId, op.on, op.accountId) };
    case 'setReminder': return { state: L.setReminder(s, op.serviceId, op.on) };
  }
}

/** Tema del design system de la app en el formato del contrato. */
export function themeSnapshot(t: { dark: boolean; colors: Record<string, string>; spacing: Record<string, number>; radius: Record<string, number>;
  typography: Record<string, { fontSize: number; lineHeight: number; fontWeight: string }>; sizing: { touchTarget: number } }): ThemeSnapshot {
  return { dark: t.dark, colors: { ...t.colors }, spacing: { ...t.spacing }, radius: { ...t.radius }, typography: { ...t.typography }, touchTarget: t.sizing.touchTarget };
}

/** Funcionalidades del catálogo que abre este micro frontend, con su ruta interna. */
export const PAGOS_FEATURES = {
  'pay-services': 'pagar',
  'adhered-services': 'servicios',
  'auto-debit': 'debitoAutomatico',
  'due-reminders': 'vencimientos',
  'payment-history': 'historial',
} as const;
