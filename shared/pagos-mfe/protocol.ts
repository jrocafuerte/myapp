/**
 * Contrato entre la app nativa (host) y el micro frontend de Pago de servicios.
 * Lo importan ambos lados; no depende de React, React Native ni Next.js.
 *
 * Reglas:
 *  - El host es la única fuente de verdad: datos y reglas de negocio viven en la app.
 *    El micro frontend solo muestra el contexto que recibe y pide operaciones.
 *  - Todo mensaje lleva `protocol` y `v`. Un mensaje con otra versión se ignora.
 *  - Ambos lados validan cada mensaje con `parseMessage` antes de usarlo.
 */

export const PROTOCOL = 'bancoplus.pagos-servicios' as const;
export const VERSION = 1 as const;

export type ServiceType = 'Luz' | 'Agua' | 'Gas' | 'Internet' | 'Telefonía' | 'TV' | 'Impuestos' | 'Otro';
export const SERVICE_TYPES: ServiceType[] = ['Luz', 'Agua', 'Gas', 'Internet', 'Telefonía', 'TV', 'Impuestos', 'Otro'];
export type Currency = 'USD' | 'EUR' | 'GBP';

/** Rutas del micro frontend. La app abre una según la funcionalidad elegida. */
export const ROUTES = {
  pagar: '/',
  servicios: '/servicios/',
  debitoAutomatico: '/debito-automatico/',
  vencimientos: '/vencimientos/',
  historial: '/historial/',
} as const;
export type RouteKey = keyof typeof ROUTES;

/** Tema que envía el host: los tokens de su design system, sea cual sea la librería. */
export interface ThemeSnapshot {
  dark: boolean;
  colors: Record<string, string>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  typography: Record<string, { fontSize: number; lineHeight: number; fontWeight: string }>;
  touchTarget: number;
}

export interface AccountSnapshot { id: string; alias: string; currency: Currency; balance: number; isPrimary: boolean }
export interface ServiceSnapshot {
  id: string; company: string; type: ServiceType; customerNumber: string; amountDue: number; dueDate: string;
  autoDebit: boolean; autoDebitAccountId?: string; reminder: boolean;
}
export interface PaymentSnapshot { id: string; date: string; description: string; amount: number; currency: Currency; reference: string; accountAlias: string }

/** Todo lo que el micro frontend necesita para dibujarse. */
export interface HostContext {
  locale: 'es' | 'en';
  hideBalances: boolean;
  theme: ThemeSnapshot;
  accounts: AccountSnapshot[];
  services: ServiceSnapshot[];
  payments: PaymentSnapshot[];
}

/** Operaciones que el micro frontend puede pedir. El host las valida y ejecuta. */
export type Operation =
  | { name: 'payService'; serviceId: string; accountId: string }
  | { name: 'addService'; company: string; type: ServiceType; customerNumber: string }
  | { name: 'removeService'; serviceId: string }
  | { name: 'setAutoDebit'; serviceId: string; on: boolean; accountId?: string }
  | { name: 'setReminder'; serviceId: string; on: boolean };

export interface Receipt { reference: string; description: string; amount: number; currency: Currency; date: string; accountAlias: string }

export type HostMessage =
  | { type: 'init'; payload: { context: HostContext } }
  | { type: 'context'; payload: { context: HostContext } }
  | { type: 'response'; payload: { requestId: string; ok: true; receipt?: Receipt } | { requestId: string; ok: false; error: string } }
  | { type: 'back'; payload: Record<string, never> };

export type MfeMessage =
  | { type: 'ready'; payload: { route: string } }
  | { type: 'request'; payload: { requestId: string; op: Operation } }
  | { type: 'title'; payload: { title: string } }
  | { type: 'haptic'; payload: { kind: 'selection' | 'success' | 'error' } }
  | { type: 'share'; payload: { message: string } }
  | { type: 'close'; payload: Record<string, never> };

export type Envelope<M> = M & { protocol: typeof PROTOCOL; v: typeof VERSION };

export const envelope = <M extends HostMessage | MfeMessage>(m: M): Envelope<M> => ({ protocol: PROTOCOL, v: VERSION, ...m });

/* --------------------------- validación en runtime --------------------------- */
type Guard = (x: unknown) => boolean;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (max = 500): Guard => (x) => typeof x === 'string' && x.length <= max;
const bool: Guard = (x) => typeof x === 'boolean';
const num: Guard = (x) => typeof x === 'number' && Number.isFinite(x);
const opt = (g: Guard): Guard => (x) => x === undefined || g(x);
const oneOf = (vals: readonly unknown[]): Guard => (x) => vals.includes(x);
const arr = (g: Guard, max = 500): Guard => (x) => Array.isArray(x) && x.length <= max && x.every(g);
const shape = (spec: Record<string, Guard>): Guard => (x) => isObj(x) && Object.entries(spec).every(([k, g]) => g(x[k]));
const record = (g: Guard): Guard => (x) => isObj(x) && Object.keys(x).length <= 100 && Object.values(x).every(g);

const currency = oneOf(['USD', 'EUR', 'GBP']);
const id = str(80);
const theme = shape({
  dark: bool, colors: record(str(40)), spacing: record(num), radius: record(num), touchTarget: num,
  typography: record(shape({ fontSize: num, lineHeight: num, fontWeight: str(10) })),
});
const context = shape({
  locale: oneOf(['es', 'en']), hideBalances: bool, theme,
  accounts: arr(shape({ id, alias: str(40), currency, balance: num, isPrimary: bool }), 20),
  services: arr(shape({ id, company: str(80), type: oneOf(SERVICE_TYPES), customerNumber: str(40), amountDue: num, dueDate: str(10), autoDebit: bool, autoDebitAccountId: opt(id), reminder: bool })),
  payments: arr(shape({ id, date: str(40), description: str(200), amount: num, currency, reference: str(40), accountAlias: str(40) })),
});
const operation: Guard = (x) => {
  if (!isObj(x)) return false;
  switch (x.name) {
    case 'payService': return shape({ serviceId: id, accountId: id })(x);
    case 'addService': return shape({ company: str(80), type: oneOf(SERVICE_TYPES), customerNumber: str(40) })(x);
    case 'removeService': return shape({ serviceId: id })(x);
    case 'setAutoDebit': return shape({ serviceId: id, on: bool, accountId: opt(id) })(x);
    case 'setReminder': return shape({ serviceId: id, on: bool })(x);
    default: return false;
  }
};
const receipt = shape({ reference: str(40), description: str(200), amount: num, currency, date: str(40), accountAlias: str(40) });
const empty: Guard = (x) => isObj(x);

const HOST: Record<HostMessage['type'], Guard> = {
  init: shape({ context }),
  context: shape({ context }),
  response: (x) => isObj(x) && id(x.requestId) && (x.ok === true ? opt(receipt)(x.receipt) : x.ok === false && str(300)(x.error)),
  back: empty,
};
const MFE: Record<MfeMessage['type'], Guard> = {
  ready: shape({ route: str(200) }),
  request: shape({ requestId: id, op: operation }),
  title: shape({ title: str(60) }),
  haptic: shape({ kind: oneOf(['selection', 'success', 'error']) }),
  share: shape({ message: str(2000) }),
  close: empty,
};

function parse<M extends { type: string }>(raw: unknown, guards: Record<string, Guard>): Envelope<M> | null {
  let data = raw;
  if (typeof raw === 'string') {
    if (raw.length > 500_000) return null;
    try { data = JSON.parse(raw); } catch { return null; }
  }
  if (!isObj(data) || data.protocol !== PROTOCOL || data.v !== VERSION || typeof data.type !== 'string') return null;
  const g = guards[data.type];
  return g && g(data.payload) ? (data as unknown as Envelope<M>) : null;
}

/** Valida un mensaje que llega al micro frontend desde el host. */
export const parseHostMessage = (raw: unknown) => parse<HostMessage>(raw, HOST);
/** Valida un mensaje que llega al host desde el micro frontend. */
export const parseMfeMessage = (raw: unknown) => parse<MfeMessage>(raw, MFE);

/** Construye la URL que abre el host. `theme` evita un destello de color antes del `init`. */
export function mfeUrl(base: string, route: RouteKey, opts: { embed: 'native' | 'web'; dark: boolean }) {
  // Ruta relativa: respeta una base con subcarpeta (p. ej. https://cdn.banco/pagos/).
  const u = new URL(ROUTES[route].replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);
  u.searchParams.set('embed', opts.embed);
  u.searchParams.set('theme', opts.dark ? 'dark' : 'light');
  u.searchParams.set('v', String(VERSION));
  return u.toString();
}
