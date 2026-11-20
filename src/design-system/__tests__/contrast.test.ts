/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darkColors, lightColors, type ColorToken, type Colors } from '../theme';

/** Contraste WCAG 2.x entre dos colores hex. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// [texto, fondo, mínimo]. 4.5 = texto normal (AA); 3 = texto grande/íconos (AA).
const PAIRS: [ColorToken, ColorToken, number][] = [
  ['text', 'bg', 4.5], ['text', 'card', 4.5], ['muted', 'card', 4.5], ['muted', 'bg', 4.5], ['text', 'input', 4.5],
  ['primary', 'card', 4.5], ['primary', 'primarySoft', 4.5], ['primaryText', 'primary', 4.5],
  ['success', 'card', 4.5], ['danger', 'card', 4.5], ['warning', 'card', 4.5], ['danger', 'dangerSoft', 3],
  ['heroText', 'hero', 4.5], ['inverse', 'hero', 4.5], ['inverse', 'danger', 3],
  ['inverse', 'cardDebit', 4.5], ['inverse', 'cardCredit', 4.5], ['inverse', 'cardVirtual', 4.5], ['inverse', 'cardInactive', 4.5],
  ['highlight', 'cardInactive', 3],
];

for (const [name, colors] of [['claro', lightColors], ['oscuro', darkColors]] as [string, Colors][]) {
  test(`contraste WCAG AA en modo ${name}`, () => {
    const fails = PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(colors[fg], colors[bg]) }))
      .filter((p) => p.ratio < p.min).map((p) => `${p.fg} sobre ${p.bg}: ${p.ratio.toFixed(2)} (mín. ${p.min})`);
    assert.deepEqual(fails, []);
  });
}
