/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// Cuenta los ids declarados en los módulos sin cargar React Native.
test('el catálogo tiene 117 funcionalidades con ids únicos', () => {
  const dir = join(__dirname, '../../features/modules');
  const ids = readdirSync(dir).flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/\{ id: '([a-z0-9-]+)', module:/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, 'ids duplicados');
  assert.equal(ids.length, 117);
});
