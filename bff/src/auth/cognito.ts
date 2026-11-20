/**
 * Cognito: el BFF hace de intermediario para que la app no necesite el SDK de AWS.
 * Los tokens que devuelve los valida API Gateway con su autorizador JWT en cada request.
 */
import {
  ChangePasswordCommand, CognitoIdentityProviderClient, InitiateAuthCommand, type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';
import { HttpError } from '../http';
import type { AuthProvider } from './provider';

const INVALID = new Set(['NotAuthorizedException', 'UserNotFoundException', 'UserNotConfirmedException', 'PasswordResetRequiredException']);

export class CognitoAuth implements AuthProvider {
  private client = new CognitoIdentityProviderClient({});
  constructor(private clientId: string) {}

  private async initiate(flow: 'USER_PASSWORD_AUTH' | 'REFRESH_TOKEN_AUTH', params: Record<string, string>): Promise<AuthenticationResultType> {
    try {
      const r = await this.client.send(new InitiateAuthCommand({ ClientId: this.clientId, AuthFlow: flow, AuthParameters: params }));
      // Un desafío (MFA, contraseña nueva) no se resuelve en esta versión: se informa como credenciales inválidas.
      if (!r.AuthenticationResult?.AccessToken) throw new HttpError(401, 'credenciales_invalidas');
      return r.AuthenticationResult;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (e instanceof Error && INVALID.has(e.name)) throw new HttpError(401, flow === 'REFRESH_TOKEN_AUTH' ? 'sesion_expirada' : 'credenciales_invalidas');
      throw e;
    }
  }

  async login(username: string, password: string) {
    const r = await this.initiate('USER_PASSWORD_AUTH', { USERNAME: username, PASSWORD: password });
    return { accessToken: r.AccessToken!, refreshToken: r.RefreshToken!, expiresIn: r.ExpiresIn ?? 900 };
  }

  async refresh(refreshToken: string) {
    const r = await this.initiate('REFRESH_TOKEN_AUTH', { REFRESH_TOKEN: refreshToken });
    return { accessToken: r.AccessToken!, expiresIn: r.ExpiresIn ?? 900 };
  }

  async changePassword(accessToken: string, current: string, next: string) {
    try {
      await this.client.send(new ChangePasswordCommand({ AccessToken: accessToken, PreviousPassword: current, ProposedPassword: next }));
    } catch (e) {
      if (e instanceof Error && e.name === 'NotAuthorizedException') throw new HttpError(422, 'contrasena_actual_incorrecta');
      if (e instanceof Error && e.name === 'InvalidPasswordException') throw new HttpError(422, 'nueva_contrasena_debe_tener');
      throw e;
    }
  }

  async verifyPassword(username: string, password: string) {
    try { await this.login(username, password); return true; } catch (e) { if (e instanceof HttpError) return false; throw e; }
  }
}
