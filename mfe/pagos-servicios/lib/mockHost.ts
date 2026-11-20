/**
 * Host simulado para desarrollar el micro frontend sin la app (npm run dev).
 * Solo se activa con NEXT_PUBLIC_STANDALONE_MOCK=1; en producción el módulo exige la app.
 * Sus reglas son una aproximación: las reales viven en la app (src/store/logic.ts).
 */
import type { HostContext, Operation, Receipt } from '../../../shared/pagos-mfe/protocol';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function mockContext(dark: boolean): HostContext {
  return {
    locale: 'es', hideBalances: false,
    theme: { dark, colors: {}, spacing: {}, radius: {}, typography: {}, touchTarget: 44 },
    accounts: [
      { id: 'acc-1', alias: 'Cuenta Nómina', currency: 'USD', balance: 4820.35, isPrimary: true },
      { id: 'acc-2', alias: 'Ahorros', currency: 'USD', balance: 12650, isPrimary: false },
    ],
    services: [
      { id: 'srv-1', company: 'Electro Sur', type: 'Luz', customerNumber: '778812', amountDue: 74.3, dueDate: day(6), autoDebit: false, reminder: true },
      { id: 'srv-2', company: 'Aguas Claras', type: 'Agua', customerNumber: '55120', amountDue: 31.8, dueDate: day(15), autoDebit: true, autoDebitAccountId: 'acc-1', reminder: true },
      { id: 'srv-3', company: 'FibraNet', type: 'Internet', customerNumber: 'FN-9921', amountDue: 45, dueDate: day(2), autoDebit: false, reminder: true },
    ],
    payments: [
      { id: 'p-1', date: new Date(Date.now() - 864e5 * 9).toISOString(), description: 'Pago Luz - Electro Sur', amount: -68.2, currency: 'USD', reference: 'REF100231', accountAlias: 'Cuenta Nómina' },
    ],
  };
}

export function mockExecute(c: HostContext, op: Operation): { context: HostContext; receipt?: Receipt } | { error: string } {
  const next: HostContext = JSON.parse(JSON.stringify(c));
  const srv = 'serviceId' in op ? next.services.find((s) => s.id === op.serviceId) : undefined;
  switch (op.name) {
    case 'payService': {
      const acc = next.accounts.find((a) => a.id === op.accountId);
      if (!srv || !acc) return { error: 'Servicio o cuenta no encontrados.' };
      if (acc.balance < srv.amountDue) return { error: `Saldo insuficiente en ${acc.alias}.` };
      acc.balance -= srv.amountDue;
      const receipt: Receipt = { reference: `REF${Math.floor(100000 + Math.random() * 899999)}`, description: `Pago ${srv.type} - ${srv.company}`, amount: srv.amountDue, currency: acc.currency, date: new Date().toISOString(), accountAlias: acc.alias };
      next.payments.unshift({ id: receipt.reference, date: receipt.date, description: receipt.description, amount: -srv.amountDue, currency: acc.currency, reference: receipt.reference, accountAlias: acc.alias });
      srv.amountDue = 0;
      return { context: next, receipt };
    }
    case 'addService':
      if (!/^[A-Za-z0-9-]{4,20}$/.test(op.customerNumber.trim())) return { error: 'Número de cliente inválido (4-20 caracteres).' };
      next.services.push({ id: `srv-${Date.now()}`, company: op.company.trim(), type: op.type, customerNumber: op.customerNumber.trim(), amountDue: 52.4, dueDate: day(12), autoDebit: false, reminder: true });
      return { context: next };
    case 'removeService': next.services = next.services.filter((s) => s.id !== op.serviceId); return { context: next };
    case 'setAutoDebit': if (srv) { srv.autoDebit = op.on; srv.autoDebitAccountId = op.on ? op.accountId : undefined; } return { context: next };
    case 'setReminder': if (srv) srv.reminder = op.on; return { context: next };
  }
}
