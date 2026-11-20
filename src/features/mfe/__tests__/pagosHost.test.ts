/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { envelope, parseHostMessage } from '../../../../shared/pagos-mfe/protocol';
import { createSeed } from '../../../store/seed';
import { buildContext, execute } from '../pagosHost';

const theme = { dark: false, colors: { bg: '#f3f6fa' }, spacing: { md: 12 }, radius: { md: 12 }, typography: {}, touchTarget: 44 };

test('el contexto que envía la app cumple el contrato', () => {
  const context = buildContext(createSeed(), theme);
  assert.ok(parseHostMessage(envelope({ type: 'init', payload: { context } })));
  assert.equal(context.services.length, 3);
});

test('pagar un servicio usa la lógica de la app y devuelve el comprobante', () => {
  const s = createSeed();
  const before = s.accounts.find((a) => a.id === 'acc-1')!.balance;
  const { state, receipt } = execute(s, { name: 'payService', serviceId: 'srv-1', accountId: 'acc-1' });
  assert.equal(state.services.find((x) => x.id === 'srv-1')!.amountDue, 0);
  assert.equal(state.accounts.find((a) => a.id === 'acc-1')!.balance, Math.round((before - 74.3) * 100) / 100);
  assert.equal(receipt?.amount, 74.3);
  assert.equal(receipt?.description, 'Pago Luz - Electro Sur');
  assert.ok(state.transactions.some((t) => t.reference === receipt?.reference));
});

test('las reglas de la app aplican a las operaciones del micro frontend', () => {
  const locked = { ...createSeed(), user: { ...createSeed().user, emergencyLocked: true } };
  assert.throws(() => execute(locked, { name: 'payService', serviceId: 'srv-1', accountId: 'acc-1' }), /bloqueada/);
  assert.throws(() => execute(createSeed(), { name: 'addService', company: 'Empresa X', type: 'Luz', customerNumber: '1' }), /inválido/);
  assert.throws(() => execute(createSeed(), { name: 'setAutoDebit', serviceId: 'srv-1', on: true }), /cuenta/);
});
