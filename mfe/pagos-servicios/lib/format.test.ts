/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysUntil, money } from './format';

test('formatea montos igual que la app nativa', () => {
  assert.equal(money(4820.35), '$4,820.35');
  assert.equal(money(-74.3), '−$74.30');
  assert.equal(money(820, 'EUR'), '€820.00');
  assert.equal(money(10, 'USD', { hidden: true }), '$ ••••');
});

test('calcula días hasta el vencimiento', () => {
  const now = new Date('2026-11-20T15:00:00Z');
  assert.equal(daysUntil('2026-11-22', now), 2);
  assert.equal(daysUntil('2026-11-18', now), -2);
  assert.equal(daysUntil('2026-11-20', now), 0);
});
