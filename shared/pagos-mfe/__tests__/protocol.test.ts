/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROTOCOL, VERSION, envelope, mfeUrl, parseHostMessage, parseMfeMessage } from '../protocol';

const ctx = {
  locale: 'es', hideBalances: false,
  theme: { dark: false, colors: { bg: '#fff' }, spacing: { md: 12 }, radius: { md: 12 }, typography: { body: { fontSize: 15, lineHeight: 21, fontWeight: '400' } }, touchTarget: 44 },
  accounts: [{ id: 'acc-1', alias: 'Nómina', currency: 'USD', balance: 10, isPrimary: true }],
  services: [{ id: 'srv-1', company: 'Electro', type: 'Luz', customerNumber: '1234', amountDue: 5, dueDate: '2026-12-01', autoDebit: false, reminder: true }],
  payments: [],
};

test('acepta mensajes válidos en ambos sentidos, como objeto o como JSON', () => {
  assert.ok(parseHostMessage(envelope({ type: 'init', payload: { context: ctx as never } })));
  assert.ok(parseHostMessage(JSON.stringify(envelope({ type: 'response', payload: { requestId: 'r1', ok: false, error: 'Saldo insuficiente.' } }))));
  assert.ok(parseMfeMessage(envelope({ type: 'request', payload: { requestId: 'r1', op: { name: 'payService', serviceId: 'srv-1', accountId: 'acc-1' } } })));
  assert.ok(parseMfeMessage(envelope({ type: 'close', payload: {} })));
});

test('rechaza otra versión, otro protocolo, tipos desconocidos y JSON inválido', () => {
  const ok = envelope({ type: 'close', payload: {} });
  assert.equal(parseMfeMessage({ ...ok, v: 2 }), null);
  assert.equal(parseMfeMessage({ ...ok, protocol: 'otro' }), null);
  assert.equal(parseMfeMessage({ ...ok, type: 'borrarTodo' }), null);
  assert.equal(parseMfeMessage('{no es json'), null);
  assert.equal(parseMfeMessage(null), null);
});

test('rechaza operaciones mal formadas o no permitidas', () => {
  const req = (op: unknown) => ({ protocol: PROTOCOL, v: VERSION, type: 'request', payload: { requestId: 'r1', op } });
  assert.equal(parseMfeMessage(req({ name: 'payService', serviceId: 'srv-1' })), null); // falta la cuenta
  assert.equal(parseMfeMessage(req({ name: 'payService', serviceId: 'srv-1', accountId: 7 })), null);
  assert.equal(parseMfeMessage(req({ name: 'transferirTodo', to: 'x' })), null);
  assert.equal(parseMfeMessage(req({ name: 'addService', company: 'X', type: 'Casino', customerNumber: '1234' })), null);
});

test('rechaza contextos con datos inválidos o excesivos', () => {
  const bad = { ...ctx, accounts: [{ ...ctx.accounts[0], balance: 'mucho' }] };
  assert.equal(parseHostMessage(envelope({ type: 'init', payload: { context: bad as never } })), null);
  assert.equal(parseHostMessage('x'.repeat(600_000)), null);
});

test('arma la URL del micro frontend con ruta, modo y tema', () => {
  assert.equal(mfeUrl('http://localhost:3001', 'servicios', { embed: 'native', dark: true }), 'http://localhost:3001/servicios/?embed=native&theme=dark&v=1');
  assert.equal(mfeUrl('https://cdn.banco/pagos/', 'pagar', { embed: 'web', dark: false }), 'https://cdn.banco/pagos/?embed=web&theme=light&v=1');
});
