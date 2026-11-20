/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BankError, transferToBeneficiary } from '../../store/logic';
import { createSeed } from '../../store/seed';
import { fetchRemoteConfig } from '../fetch';
import { DEFAULT_MESSAGES, formatMessage } from '../messages';
import { EMPTY_CONFIG, findMaintenance, validateRemoteConfig } from '../schema';

const messageText = (cfg: { messages?: Record<string, string> }, code: keyof typeof DEFAULT_MESSAGES, params?: Record<string, string | number>) =>
  formatMessage(cfg.messages?.[code] ?? DEFAULT_MESSAGES[code], params);

test('los errores de negocio llevan código y el texto de fábrica de siempre', () => {
  try { transferToBeneficiary(createSeed(), 'acc-1', 'ben-1', 3000); assert.fail('debía fallar'); } catch (e) {
    assert.ok(e instanceof BankError);
    assert.equal(e.code, 'supera_limite_operacion_usd');
    assert.deepEqual(e.params, { limit: 2500 });
    assert.equal(e.message, 'Supera tu límite por operación (2500 USD).');
  }
});

test('un texto remoto reemplaza al de fábrica y conserva las variables', () => {
  const { config, errors } = validateRemoteConfig({ schemaVersion: 1, messages: { saldo_insuficiente: 'No te alcanza el saldo de {alias}.' } });
  assert.deepEqual(errors, []);
  assert.equal(messageText(config, 'saldo_insuficiente', { alias: 'Ahorros' }), 'No te alcanza el saldo de Ahorros.');
  assert.equal(messageText(EMPTY_CONFIG, 'saldo_insuficiente', { alias: 'Ahorros' }), 'Saldo insuficiente en Ahorros.');
});

test('descarta entradas inválidas sin perder las válidas', () => {
  const { config, errors } = validateRemoteConfig({
    schemaVersion: 1,
    messages: { saldo_insuficiente: 'Sin saldo en {cuenta}.', no_existe_este_codigo: 'x', iban_invalido: 'Revisá el IBAN.' },
    features: { 'pay-services': { title: 'Pagar cuentas' }, 'transfer-own': { title: 42 } },
    maintenance: [{ scope: 'todo', message: 'x' }, { scope: 'feature:pay-services', message: 'Volvemos pronto.' }],
  });
  assert.equal(config.messages?.iban_invalido, 'Revisá el IBAN.');
  assert.equal(config.messages?.saldo_insuficiente, undefined); // {cuenta} no existe; solo {alias}
  assert.equal(config.features?.['pay-services']?.title, 'Pagar cuentas');
  assert.equal(config.features?.['transfer-own'], undefined);
  assert.equal(config.maintenance?.length, 1);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /Disponibles: \{alias\}/);
});

test('un documento con otra versión o que no es un objeto se ignora por completo', () => {
  assert.equal(validateRemoteConfig({ schemaVersion: 2, messages: {} }).config, EMPTY_CONFIG);
  assert.equal(validateRemoteConfig('hola').config, EMPTY_CONFIG);
});

test('mantenimiento: ventana horaria y alcance app, módulo y funcionalidad', () => {
  const now = Date.parse('2026-11-20T15:00:00Z');
  const { config } = validateRemoteConfig({
    schemaVersion: 1,
    maintenance: [
      { scope: 'module:inversiones', message: 'Mercado cerrado.', from: '2026-11-20T14:00:00Z', until: '2026-11-20T16:00:00Z' },
      { scope: 'feature:pay-services', message: 'Futuro.', from: '2026-11-21T00:00:00Z' },
    ],
  });
  assert.equal(findMaintenance(config, { featureId: 'buy-asset', moduleId: 'inversiones' }, now)?.message, 'Mercado cerrado.');
  assert.equal(findMaintenance(config, { featureId: 'buy-asset', moduleId: 'inversiones' }, Date.parse('2026-11-20T17:00:00Z')), undefined);
  assert.equal(findMaintenance(config, { featureId: 'pay-services', moduleId: 'pagos' }, now), undefined);
  const app = validateRemoteConfig({ schemaVersion: 1, maintenance: [{ scope: 'app', message: 'Todo en pausa.' }] }).config;
  assert.equal(findMaintenance(app, {}, now)?.message, 'Todo en pausa.');
  assert.equal(findMaintenance(app, { featureId: 'x', moduleId: 'y' }, now)?.message, 'Todo en pausa.');
});

test('la descarga tolera errores de red, JSON inválido y documentos enormes', async () => {
  const fake = (body: string, ok = true) => (async () => ({ ok, text: async () => body })) as unknown as typeof fetch;
  assert.equal(await fetchRemoteConfig(''), null);
  assert.equal(await fetchRemoteConfig('https://x', fake('{no json')), null);
  assert.equal(await fetchRemoteConfig('https://x', fake('{}', false)), null);
  assert.equal(await fetchRemoteConfig('https://x', fake(' '.repeat(300 * 1024))), null);
  assert.equal(await fetchRemoteConfig('https://x', (async () => { throw new Error('offline'); }) as unknown as typeof fetch), null);
  const cfg = await fetchRemoteConfig('https://x', fake(JSON.stringify({ schemaVersion: 1, revision: 'r1' })));
  assert.equal(cfg?.revision, 'r1');
});
