/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

/**
 * Garantiza que la app dependa del design system SOLO a través de src/design-system/index.ts.
 * Si alguien usa primitivas de React Native, íconos o colores sueltos, el reemplazo de librería se rompe.
 */
const SRC = join(__dirname, '../..');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === 'design-system' || f === '__tests__' ? [] : files(p)) : /\.tsx?$/.test(f) ? [p] : [];
});

const RULES: [RegExp, string][] = [
  [/import \{[^}]*\b(View|Text|Pressable|TextInput|Switch|ActivityIndicator|Image)\b[^}]*\} from 'react-native'/, 'usa componentes del design system en lugar de primitivas de React Native'],
  [/@expo\/vector-icons/, 'usa <Icon> del design system'],
  [/#[0-9A-Fa-f]{3,6}\b/, 'usa un rol de color del tema en lugar de un hex'],
  [/from '(\.\.\/)+design-system\/(adapters|tokens|theme|contracts)/, "importá desde 'design-system' (index), no desde archivos internos"],
];
const ALLOW: string[] = []; // datos de ejemplo (color de avatar inicial)

test('la app usa el design system solo a través de su punto de entrada', () => {
  const problems = files(SRC).filter((f) => !ALLOW.some((a) => f.endsWith(a))).flatMap((f) =>
    readFileSync(f, 'utf8').split('\n').flatMap((line, i) =>
      RULES.filter(([re]) => re.test(line)).map(([, msg]) => `${relative(SRC, f)}:${i + 1} → ${msg}`)));
  assert.deepEqual(problems, []);
});
