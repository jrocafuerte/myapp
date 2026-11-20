/** λ me — GET /v1/me: la vista del cliente para la app, sin secretos. */
import { toClientState } from '../../../shared/domain/logic';
import { getDeps } from '../deps';
import { handle, identity, json, type HttpEvent } from '../http';

export async function route(event: HttpEvent) {
  const { state, version } = await getDeps().core.snapshot(identity(event));
  return json(200, { state: toClientState(state), version });
}

export const handler = handle('me', route);
