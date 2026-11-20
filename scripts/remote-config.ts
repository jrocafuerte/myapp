/**
 * Herramientas para quien administra la configuración remota.
 *   npm run config:validate -- remote-config/config.example.json   valida un JSON antes de publicarlo
 *   npm run config:catalog                                          regenera remote-config/CATALOGO.md
 * Lee los ids del código fuente sin cargar React Native.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_MESSAGES, placeholders } from '../src/remote-config/messages';
import { validateRemoteConfig } from '../src/remote-config/schema';

const root = join(__dirname, '..');
const modulesDir = join(root, 'src/features/modules');
const features = readdirSync(modulesDir).flatMap((f) =>
  [...readFileSync(join(modulesDir, f), 'utf8').matchAll(/\{ id: '([a-z0-9-]+)', module: '([a-z]+)', title: '([^']+)', description: '([^']+)'/g)]
    .map((m) => ({ id: m[1], module: m[2], title: m[3], description: m[4] })));
const moduleTitles = Object.fromEntries([...readFileSync(join(root, 'src/features/types.ts'), 'utf8').matchAll(/^\s+([a-z]+): \{ title: '([^']+)'/gm)].map((m) => [m[1], m[2]]));
const i18n = readFileSync(join(root, 'src/utils/i18n.ts'), 'utf8');
const esBlock = /es: \{([\s\S]*?)\},\n\s+en:/.exec(i18n)![1];
const texts = Object.fromEntries([...esBlock.matchAll(/(\w+): '([^']*)'/g)].map((m) => [m[1], m[2]]));
const known = { features: features.map((f) => f.id), modules: Object.keys(moduleTitles), texts: Object.keys(texts).flatMap((k) => [k, `${k}.es`, `${k}.en`]) };

const [cmd, file] = process.argv.slice(2);
if (cmd === 'validate') {
  if (!file) { console.error('Indica el archivo: npm run config:validate -- ruta/config.json'); process.exit(2); }
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`✗ JSON inválido: ${(e as Error).message}`); process.exit(1); }
  const size = readFileSync(file).length;
  const { config, errors, warnings } = validateRemoteConfig(raw, known);
  if (size > 256 * 1024) errors.push(`El archivo pesa ${size} bytes; el máximo es 262144.`);
  warnings.forEach((w) => console.log(`⚠ ${w}`));
  errors.forEach((e) => console.log(`✗ ${e}`));
  const n = (o?: object) => Object.keys(o ?? {}).length;
  console.log(`\n${errors.length ? '✗ Con errores: la app descartará esas entradas.' : '✓ Válido.'} revision=${config.revision ?? '—'} · mensajes ${n(config.messages)} · textos ${n(config.texts)} · funcionalidades ${n(config.features)} · módulos ${n(config.modules)} · mantenimientos ${config.maintenance?.length ?? 0}`);
  process.exit(errors.length ? 1 : 0);
} else if (cmd === 'catalog') {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const md = [
    '# Catálogo de la configuración remota',
    '',
    '> Generado con `npm run config:catalog`. No lo edites a mano.',
    '',
    `## Mensajes de error (${Object.keys(DEFAULT_MESSAGES).length})`,
    '',
    'Sección `messages`. Un texto nuevo solo puede usar las variables de su columna.',
    '',
    '| Código | Texto por defecto | Variables |', '|---|---|---|',
    ...Object.entries(DEFAULT_MESSAGES).map(([k, v]) => `| \`${k}\` | ${esc(v)} | ${placeholders(v).map((p) => `\`{${p}}\``).join(' ') || '—'} |`),
    '',
    `## Funcionalidades (${features.length})`,
    '',
    'Sección `features` (`title`, `description`, `hidden`) y mantenimiento con `"scope": "feature:<id>"`.',
    '',
    '| Id | Módulo | Nombre | Descripción |', '|---|---|---|---|',
    ...features.map((f) => `| \`${f.id}\` | \`${f.module}\` | ${esc(f.title)} | ${esc(f.description)} |`),
    '',
    `## Módulos (${Object.keys(moduleTitles).length})`,
    '',
    'Sección `modules` (`title`, `hidden`) y mantenimiento con `"scope": "module:<id>"`.',
    '',
    '| Id | Nombre |', '|---|---|',
    ...Object.entries(moduleTitles).map(([k, v]) => `| \`${k}\` | ${esc(v)} |`),
    '',
    `## Textos de interfaz (${Object.keys(texts).length})`,
    '',
    'Sección `texts`. Usa la clave sola para todos los idiomas, o `<clave>.es` / `<clave>.en` para uno.',
    '',
    '| Clave | Texto por defecto (es) |', '|---|---|',
    ...Object.entries(texts).map(([k, v]) => `| \`${k}\` | ${esc(v)} |`),
    '',
  ].join('\n');
  writeFileSync(join(root, 'remote-config/CATALOGO.md'), md);
  console.log(`Catálogo escrito: ${Object.keys(DEFAULT_MESSAGES).length} mensajes, ${features.length} funcionalidades, ${Object.keys(moduleTitles).length} módulos, ${Object.keys(texts).length} textos.`);
} else {
  console.error('Uso: npm run config:validate -- <archivo.json>  |  npm run config:catalog');
  process.exit(2);
}
