/** Proveedor de identidad. En AWS: Amazon Cognito. En desarrollo: proveedor local con usuarios de prueba. */
export interface LoginTokens { accessToken: string; refreshToken: string; expiresIn: number }

export interface AuthProvider {
  /** Lanza HttpError 401 'credenciales_invalidas' si no coinciden. */
  login(username: string, password: string): Promise<LoginTokens>;
  refresh(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
  changePassword(accessToken: string, current: string, next: string): Promise<void>;
  /** Comprueba la contraseña sin crear sesión (p. ej. para levantar el bloqueo de emergencia). */
  verifyPassword(username: string, password: string): Promise<boolean>;
}
