/**
 * Proveedor de identidad para DESARROLLO (servidor local y tests). Emite JWT HS256 con un secreto
 * de desarrollo y usuarios de prueba en memoria. Nunca se despliega: en AWS se usa Cognito.
 */
import { randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { HttpError } from '../http';
import type { AuthProvider } from './provider';

const SECRET = new TextEncoder().encode(process.env.LOCAL_JWT_SECRET ?? 'solo-para-desarrollo-local-no-usar-en-produccion');
const ISSUER = 'banco-plus-local';
const ACCESS_TTL_S = Number(process.env.LOCAL_ACCESS_TTL_S ?? 900);

export class LocalAuth implements AuthProvider {
  private users = new Map<string, { password: string; sub: string; email: string }>([
    ['demo', { password: 'demo1234', sub: 'local-demo', email: 'demo@bancoplus.test' }],
    ['ana', { password: 'ana12345', sub: 'local-ana', email: 'ana@bancoplus.test' }],
  ]);
  private refreshTokens = new Map<string, string>(); // token → username

  private async sign(username: string) {
    const u = this.users.get(username)!;
    return new SignJWT({ username, email: u.email, token_use: 'access' })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(u.sub).setIssuer(ISSUER).setIssuedAt().setExpirationTime(`${ACCESS_TTL_S}s`).sign(SECRET);
  }

  async login(username: string, password: string) {
    const u = this.users.get(username.trim().toLowerCase());
    if (!u || u.password !== password) throw new HttpError(401, 'credenciales_invalidas');
    const refreshToken = randomBytes(32).toString('base64url');
    this.refreshTokens.set(refreshToken, username.trim().toLowerCase());
    return { accessToken: await this.sign(username.trim().toLowerCase()), refreshToken, expiresIn: ACCESS_TTL_S };
  }

  async refresh(refreshToken: string) {
    const username = this.refreshTokens.get(refreshToken);
    if (!username) throw new HttpError(401, 'sesion_expirada');
    return { accessToken: await this.sign(username), expiresIn: ACCESS_TTL_S };
  }

  async changePassword(accessToken: string, current: string, next: string) {
    const claims = await verifyLocalToken(accessToken);
    const u = claims && this.users.get(String(claims.username));
    if (!u) throw new HttpError(401, 'sesion_expirada');
    if (u.password !== current) throw new HttpError(422, 'contrasena_actual_incorrecta');
    u.password = next;
  }

  async verifyPassword(username: string, password: string) { return this.users.get(username)?.password === password; }
}

/** Equivalente local del autorizador JWT de API Gateway. */
export async function verifyLocalToken(token: string): Promise<Record<string, string | number | boolean> | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
    return payload as Record<string, string | number | boolean>;
  } catch { return null; }
}
