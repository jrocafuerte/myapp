/**
 * Utilidades HTTP para los handlers (API Gateway HTTP API, payload v2).
 * Todos los errores salen como { error: { code, params } }: el código es el mismo que usa la app
 * (shared/domain/messages.ts), así la configuración remota también puede cambiar sus textos.
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { BankError } from '../../shared/domain/logic';
import type { MessageCode, MessageParams } from '../../shared/domain/messages';
import { log } from './logger';

export type HttpEvent = APIGatewayProxyEventV2 & {
  requestContext: APIGatewayProxyEventV2['requestContext'] & { authorizer?: { jwt?: { claims?: Record<string, string | number | boolean> } } };
};
export type Result = APIGatewayProxyResultV2;

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: MessageCode, readonly params: MessageParams = {}) { super(code); }
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

export const json = (statusCode: number, body: unknown): Result => ({ statusCode, headers: SECURITY_HEADERS, body: JSON.stringify(body) });

const MAX_BODY = 32 * 1024;
export function parseBody(event: HttpEvent): unknown {
  if (!event.body) throw new HttpError(400, 'solicitud_invalida');
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  if (text.length > MAX_BODY) throw new HttpError(413, 'solicitud_invalida');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'solicitud_invalida'); }
}

/** Identidad del usuario, puesta por el autorizador JWT de API Gateway (Cognito). */
export function identity(event: HttpEvent): { userId: string; username: string; email?: string } {
  const c = event.requestContext.authorizer?.jwt?.claims;
  const sub = typeof c?.sub === 'string' ? c.sub : undefined;
  if (!sub) throw new HttpError(401, 'sesion_expirada');
  const username = String(c?.username ?? c?.['cognito:username'] ?? sub);
  return { userId: sub, username, email: typeof c?.email === 'string' ? c.email : undefined };
}

export const header = (event: HttpEvent, name: string) => {
  const key = Object.keys(event.headers ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? event.headers[key] : undefined;
};

/** Envuelve un handler: traduce errores de negocio, de validación y desconocidos a respuestas HTTP. */
export const handle = (route: string, fn: (event: HttpEvent) => Promise<Result>) => async (event: HttpEvent): Promise<Result> => {
  const started = Date.now();
  const requestId = event.requestContext?.requestId;
  try {
    const res = await fn(event);
    log('info', 'request', { route, requestId, status: (res as { statusCode: number }).statusCode, ms: Date.now() - started });
    return res;
  } catch (e) {
    if (e instanceof HttpError) {
      log('warn', 'request', { route, requestId, status: e.status, code: e.code, ms: Date.now() - started });
      return json(e.status, { error: { code: e.code, params: e.params } });
    }
    if (e instanceof BankError) {
      log('info', 'business_rule', { route, requestId, status: 422, code: e.code, ms: Date.now() - started });
      return json(422, { error: { code: e.code, params: e.params } });
    }
    if (e instanceof ZodError) {
      log('warn', 'validation', { route, requestId, status: 400, issues: e.issues.map((i) => i.path.join('.')) });
      return json(400, { error: { code: 'solicitud_invalida', params: {} } });
    }
    log('error', 'unhandled', { route, requestId, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    return json(500, { error: { code: 'error_inesperado', params: {} } });
  }
};
