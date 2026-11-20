/**
 * Cliente HTTP del BFF: agrega el token, renueva la sesión una vez ante un 401,
 * aplica tiempo de espera y convierte los errores del servidor en BankError con su código.
 */
import { BankError } from '../../shared/domain/logic';
import { isMessageCode, type MessageParams } from '../../shared/domain/messages';
import { BFF_URL } from './config';
import { loadTokens, saveTokens, type Tokens } from './tokens';

const TIMEOUT_MS = 15000;
type Method = 'GET' | 'POST';
interface Options { body?: unknown; auth?: boolean; idempotencyKey?: string }

/** El servidor responde los errores como { error: { code, params } }. */
function toBankError(status: number, body: unknown): BankError {
  const e = (body as { error?: { code?: string; params?: MessageParams } } | null)?.error;
  if (e?.code && isMessageCode(e.code)) return new BankError(e.code, e.params ?? {});
  if (status === 401) return new BankError('sesion_expirada');
  if (status === 409) return new BankError('conflicto_version');
  return new BankError('error_inesperado');
}

async function raw(method: Method, path: string, { body, idempotencyKey }: Options, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BFF_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* respuesta no JSON */ }
    return { status: res.status, json };
  } catch {
    throw new BankError('sin_conexion');
  } finally {
    clearTimeout(timer);
  }
}

let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

async function refreshSession(): Promise<Tokens | null> {
  const current = await loadTokens();
  if (!current?.refreshToken) return null;
  const { status, json } = await raw('POST', '/v1/auth/refresh', { body: { refreshToken: current.refreshToken } });
  if (status !== 200) return null;
  const t = json as { accessToken: string; expiresIn: number };
  const next = { ...current, accessToken: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 };
  await saveTokens(next);
  return next;
}

export async function api<T>(method: Method, path: string, opts: Options = {}): Promise<T> {
  const auth = opts.auth ?? true;
  let tokens = auth ? await loadTokens() : null;
  if (auth && !tokens) { onSessionExpired(); throw new BankError('sesion_expirada'); }
  if (tokens && tokens.expiresAt - Date.now() < 30_000) tokens = (await refreshSession()) ?? tokens;
  let res = await raw(method, path, opts, tokens?.accessToken);
  if (auth && res.status === 401) {
    const renewed = await refreshSession();
    if (renewed) res = await raw(method, path, opts, renewed.accessToken);
  }
  if (auth && res.status === 401) { await saveTokens(null); onSessionExpired(); }
  if (res.status < 200 || res.status >= 300) throw toBankError(res.status, res.json);
  return res.json as T;
}

/** Clave de idempotencia: el BFF ejecuta una sola vez aunque la red reintente la misma operación. */
export const newIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
