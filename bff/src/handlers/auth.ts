/** λ auth — POST /v1/auth/login y /v1/auth/refresh (públicas), POST /v1/auth/password (con token). */
import { z } from 'zod';
import { validateNewPassword } from '../../../shared/domain/logic';
import { getDeps } from '../deps';
import { handle, header, HttpError, identity, json, parseBody, type HttpEvent } from '../http';

const Login = z.object({ username: z.string().min(1).max(128), password: z.string().min(1).max(256) }).strict();
const Refresh = z.object({ refreshToken: z.string().min(10).max(4096) }).strict();
const Password = z.object({ current: z.string().min(1).max(256), next: z.string().max(256), confirm: z.string().max(256) }).strict();

export async function route(event: HttpEvent) {
  const { auth } = getDeps();
  switch (event.routeKey) {
    case 'POST /v1/auth/login': {
      const { username, password } = Login.parse(parseBody(event));
      return json(200, await auth.login(username.trim().toLowerCase(), password));
    }
    case 'POST /v1/auth/refresh': {
      const { refreshToken } = Refresh.parse(parseBody(event));
      return json(200, await auth.refresh(refreshToken));
    }
    case 'POST /v1/auth/password': {
      identity(event);
      const token = header(event, 'authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) throw new HttpError(401, 'sesion_expirada');
      const { current, next, confirm } = Password.parse(parseBody(event));
      validateNewPassword(current, next, confirm);
      await auth.changePassword(token, current, next);
      return json(200, { ok: true });
    }
    default:
      throw new HttpError(404, 'solicitud_invalida');
  }
}

export const handler = handle('auth', route);
