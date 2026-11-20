/**
 * Lado HOST del micro frontend de Pago de servicios, sin UI (testeable en Node).
 * Traduce el estado de la app a `HostContext` y ejecuta las operaciones pedidas
 * con la misma lógica de negocio que usan las pantallas nativas.
 */
import type { HostContext, Operation, Receipt, ThemeSnapshot } from '../../../shared/pagos-mfe/protocol';
import { applyCommand, cmd, type Command } from '../../store/commands';
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

/** Traduce una operación del micro frontend a un comando del banco (lo ejecuta el gateway: local o BFF). */
export function toCommand(op: Operation): Command {
  switch (op.name) {
    case 'payService': return cmd.payService(op.serviceId, op.accountId);
    case 'addService': return cmd.addService({ company: op.company, type: op.type, customerNumber: op.customerNumber });
    case 'removeService': return cmd.removeService(op.serviceId);
    case 'setAutoDebit': return cmd.setAutoDebit(op.serviceId, op.on, op.accountId);
    case 'setReminder': return cmd.setReminder(op.serviceId, op.on);
  }
}

/** Comprobante de un pago de servicio: el movimiento nuevo que apareció tras ejecutarlo. */
export function receiptFrom(before: BankState, after: BankState, op: Operation): Receipt | undefined {
  if (op.name !== 'payService') return undefined;
  const srv = before.services.find((x) => x.id === op.serviceId);
  const known = new Set(before.transactions.map((t) => t.id));
  const tx = after.transactions.find((t) => t.description === `Pago ${srv?.type} - ${srv?.company}` && !known.has(t.id));
  const acc = after.accounts.find((a) => a.id === op.accountId);
  if (!tx || !acc) return undefined;
  return { reference: tx.reference, description: tx.description, amount: -tx.amount, currency: acc.currency, date: tx.date, accountAlias: acc.alias };
}

/** Ejecuta una operación sobre un estado (modo local y tests). Lanza BankError si no es válida. */
export function execute(s: BankState, op: Operation): { state: BankState; receipt?: Receipt } {
  const state = applyCommand(s, toCommand(op));
  return { state, receipt: receiptFrom(s, state, op) };
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
