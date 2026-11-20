/**
 * λ <dominio> — POST /v1/<dominio>/commands
 * Una Lambda por dominio (variable DOMAIN): solo acepta comandos de su dominio, escala y se
 * monitorea por separado. Requiere `Idempotency-Key`: un reintento de red devuelve la misma
 * respuesta sin ejecutar dos veces (p. ej. una transferencia).
 */
import { createHash } from 'node:crypto';
import { COMMAND_DOMAINS, type Command, type Domain } from '../../../shared/domain/commands';
import { BankError, toClientState } from '../../../shared/domain/logic';
import { parseCommand } from '../commands/schemas';
import { adapterFor } from '../core';
import { getDeps } from '../deps';
import { handle, header, HttpError, identity, json, parseBody, type HttpEvent, type Result } from '../http';
import { log } from '../logger';

const KEY = /^[A-Za-z0-9_-]{16,128}$/;

export function commandsRoute(domain: Domain) {
  return async (event: HttpEvent): Promise<Result> => {
    const customer = identity(event);
    const key = header(event, 'idempotency-key');
    if (!key || !KEY.test(key)) throw new HttpError(400, 'solicitud_invalida', { header: 'Idempotency-Key' });
    const { name, args } = parseCommand(parseBody(event));
    if (COMMAND_DOMAINS[name] !== domain) throw new HttpError(404, 'solicitud_invalida');

    const { store, core } = getDeps();
    const fingerprint = createHash('sha256').update(JSON.stringify({ name, args })).digest('hex');
    const begin = await store.beginIdempotent(customer.userId, key, fingerprint);
    if (begin.status === 'done') return { statusCode: begin.statusCode, headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true', 'Cache-Control': 'no-store' }, body: begin.body };
    if (begin.status === 'pending') throw new HttpError(409, 'operacion_en_curso');
    if (begin.status === 'mismatch') throw new HttpError(422, 'solicitud_invalida', { header: 'Idempotency-Key' });

    let res: Result;
    try {
      await adapterFor(domain, core).execute(customer, { name, args } as Command);
      const { state, version } = await core.snapshot(customer);
      res = json(200, { state: toClientState(state), version });
      log('info', 'command', { domain, command: name, requestId: event.requestContext?.requestId });
    } catch (e) {
      if (!(e instanceof BankError)) { await store.abortIdempotent(customer.userId, key); throw e; }
      // Un rechazo de negocio es definitivo: se guarda para responder igual ante un reintento.
      res = json(422, { error: { code: e.code, params: e.params } });
      log('info', 'command_rejected', { domain, command: name, code: e.code, requestId: event.requestContext?.requestId });
    }
    const r = res as { statusCode: number; body: string };
    await store.completeIdempotent(customer.userId, key, r.statusCode, r.body);
    return res;
  };
}

export const handler = (event: HttpEvent) => handle(`commands:${process.env.DOMAIN}`, commandsRoute(process.env.DOMAIN as Domain))(event);
