/**
 * CONFIGURACIÓN REMOTA — qué se puede cambiar sin publicar una versión de la app.
 *
 * Es un JSON publicado en cualquier servidor HTTPS (CDN, S3, Firebase Hosting, tu API).
 * Solo admite textos y banderas: no ejecuta código ni carga contenido externo.
 * Todo campo es opcional; lo que falte usa el valor que trae la app.
 */
import { DEFAULT_MESSAGES, isMessageCode, placeholders } from './messages';

export const SCHEMA_VERSION = 1;

export interface MaintenanceEntry {
  /** "app" (toda la app), "module:<id>" (p. ej. module:pagos) o "feature:<id>" (p. ej. feature:pay-services). */
  scope: string;
  title?: string;
  message: string;
  /** Ventana opcional (ISO 8601). Fuera de ella la entrada no aplica. */
  from?: string;
  until?: string;
}

export interface RemoteConfig {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Identificador libre de la publicación, para saber qué versión tiene cada dispositivo. */
  revision?: string;
  /** Textos de error por código (ver messages.ts). Pueden usar las mismas {variables} del texto por defecto. */
  messages?: Record<string, string>;
  /** Textos de interfaz por clave (pestañas, encabezados): ver TEXT_KEYS. */
  texts?: Record<string, string>;
  /** Nombre, descripción o visibilidad de cada funcionalidad del menú, por id. */
  features?: Record<string, { title?: string; description?: string; hidden?: boolean }>;
  /** Nombre o visibilidad de cada módulo del menú, por id. */
  modules?: Record<string, { title?: string; hidden?: boolean }>;
  maintenance?: MaintenanceEntry[];
}

export const EMPTY_CONFIG: RemoteConfig = { schemaVersion: SCHEMA_VERSION };

/* ------------------------------- validación ------------------------------- */
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const isoDate = (x: unknown) => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const SCOPE = /^(app|module:[a-z0-9-]{2,40}|feature:[a-z0-9-]{2,60})$/;

export interface Validation { config: RemoteConfig; errors: string[]; warnings: string[] }

/**
 * Valida un JSON recibido. Las entradas inválidas se descartan una por una (con un error);
 * si el documento entero no es una configuración, devuelve la configuración vacía.
 * `known` permite advertir sobre ids que la app no tiene (lo usa el validador por consola).
 */
export function validateRemoteConfig(raw: unknown, known?: { features: string[]; modules: string[]; texts: string[] }): Validation {
  const errors: string[] = []; const warnings: string[] = [];
  if (!isObj(raw)) return { config: EMPTY_CONFIG, errors: ['El documento no es un objeto JSON.'], warnings };
  if (raw.schemaVersion !== SCHEMA_VERSION) return { config: EMPTY_CONFIG, errors: [`schemaVersion debe ser ${SCHEMA_VERSION}.`], warnings };
  const config: RemoteConfig = { schemaVersion: SCHEMA_VERSION };
  if (raw.revision !== undefined) { if (text(raw.revision, 80)) config.revision = raw.revision as string; else errors.push('revision: texto de hasta 80 caracteres.'); }

  if (raw.messages !== undefined) {
    config.messages = {};
    if (!isObj(raw.messages)) errors.push('messages debe ser un objeto { código: texto }.');
    else for (const [code, value] of Object.entries(raw.messages)) {
      if (!isMessageCode(code)) { errors.push(`messages.${code}: código desconocido.`); continue; }
      if (!text(value, 300)) { errors.push(`messages.${code}: texto de 1 a 300 caracteres.`); continue; }
      const allowed = placeholders(DEFAULT_MESSAGES[code]);
      const extra = placeholders(value as string).filter((p) => !allowed.includes(p));
      if (extra.length) { errors.push(`messages.${code}: variables no disponibles {${extra.join('}, {')}}. Disponibles: ${allowed.length ? `{${allowed.join('}, {')}}` : 'ninguna'}.`); continue; }
      config.messages[code] = value as string;
    }
  }

  if (raw.texts !== undefined) {
    config.texts = {};
    if (!isObj(raw.texts)) errors.push('texts debe ser un objeto { clave: texto }.');
    else for (const [k, v] of Object.entries(raw.texts)) {
      if (!KEY.test(k) || !text(v, 80)) { errors.push(`texts.${k}: clave o texto inválido (hasta 80 caracteres).`); continue; }
      if (known && !known.texts.includes(k)) warnings.push(`texts.${k}: la app no usa esta clave.`);
      config.texts[k] = v as string;
    }
  }

  const section = <T extends object>(name: 'features' | 'modules', fields: Record<string, (x: unknown) => boolean>, ids?: string[]) => {
    const value = raw[name];
    if (value === undefined) return undefined;
    const out: Record<string, T> = {};
    if (!isObj(value)) { errors.push(`${name} debe ser un objeto { id: {...} }.`); return out; }
    for (const [id, entry] of Object.entries(value)) {
      if (!KEY.test(id) || !isObj(entry)) { errors.push(`${name}.${id}: entrada inválida.`); continue; }
      const bad = Object.entries(entry).filter(([f, v]) => !fields[f] || !fields[f](v)).map(([f]) => f);
      if (bad.length) { errors.push(`${name}.${id}: campos inválidos (${bad.join(', ')}).`); continue; }
      if (ids && !ids.includes(id)) warnings.push(`${name}.${id}: la app no tiene este id.`);
      out[id] = entry as T;
    }
    return out;
  };
  config.features = section('features', { title: (v) => text(v, 60), description: (v) => text(v, 120), hidden: (v) => typeof v === 'boolean' }, known?.features);
  config.modules = section('modules', { title: (v) => text(v, 60), hidden: (v) => typeof v === 'boolean' }, known?.modules);

  if (raw.maintenance !== undefined) {
    config.maintenance = [];
    if (!Array.isArray(raw.maintenance)) errors.push('maintenance debe ser una lista.');
    else raw.maintenance.slice(0, 50).forEach((m, i) => {
      const ok = isObj(m) && typeof m.scope === 'string' && SCOPE.test(m.scope) && text(m.message, 400)
        && (m.title === undefined || text(m.title, 60)) && (m.from === undefined || isoDate(m.from)) && (m.until === undefined || isoDate(m.until));
      if (!ok) { errors.push(`maintenance[${i}]: necesita scope ("app", "module:<id>" o "feature:<id>"), message, y fechas ISO válidas.`); return; }
      const entry = m as unknown as MaintenanceEntry;
      const scopeId = entry.scope.split(':')[1];
      if (known && entry.scope.startsWith('feature:') && !known.features.includes(scopeId)) warnings.push(`maintenance[${i}]: la funcionalidad "${scopeId}" no existe.`);
      if (known && entry.scope.startsWith('module:') && !known.modules.includes(scopeId)) warnings.push(`maintenance[${i}]: el módulo "${scopeId}" no existe.`);
      config.maintenance!.push(entry);
    });
  }
  return { config, errors, warnings };
}

/** ¿Está vigente una entrada de mantenimiento en este momento? */
export const isActive = (m: MaintenanceEntry, now = Date.now()) =>
  (!m.from || Date.parse(m.from) <= now) && (!m.until || now < Date.parse(m.until));

/** Primera entrada vigente para la funcionalidad (o el módulo, o la app entera). */
export function findMaintenance(config: RemoteConfig, target: { featureId?: string; moduleId?: string }, now = Date.now()) {
  const scopes = ['app', target.moduleId && `module:${target.moduleId}`, target.featureId && `feature:${target.featureId}`].filter(Boolean);
  return config.maintenance?.find((m) => scopes.includes(m.scope) && isActive(m, now));
}
