/**
 * Puerta de entrada de la app a los datos del banco. La UI no sabe si habla con el teléfono
 * (modo local, demo) o con el BFF en AWS: siempre envía comandos y recibe el estado nuevo.
 */
import { applyCommand, COMMAND_DOMAINS, type Command } from '../../shared/domain/commands';
import * as L from '../../shared/domain/logic';
import type { MessageCode } from '../../shared/domain/messages';
import type { BankState } from '../../shared/domain/types';
import { api, newIdempotencyKey } from './client';
import { MODE } from './config';
import { saveTokens } from './tokens';

export interface BankGateway {
  mode: 'local' | 'bff';
  /** Autentica. Con error, `state` puede traer el intento registrado (modo local). Fallas de red lanzan BankError. */
  login(state: BankState, username: string, password: string): Promise<{ state: BankState | null; error: MessageCode | null }>;
  /** Sesión previa (BFF): estado actual o null si hay que ingresar. */
  restore(): Promise<BankState | null>;
  logout(): Promise<void>;
  execute(state: BankState, command: Command): Promise<BankState>;
  refresh(state: BankState): Promise<BankState>;
  revealCard(state: BankState, cardId: string, otp: string): Promise<{ number: string; cvv: string }>;
  changePassword(state: BankState, current: string, next: string, confirm: string): Promise<BankState>;
}

const localGateway: BankGateway = {
  mode: 'local',
  async login(state, username, password) {
    const { ok, state: next } = L.login(state, username, password);
    return { state: next, error: ok ? null : 'credenciales_invalidas' };
  },
  restore: async () => null,
  logout: async () => {},
  execute: async (state, command) => applyCommand(state, command),
  refresh: async (state) => state,
  async revealCard(state, cardId, otp) {
    if (otp !== L.otpCode(state.user.username)) throw new L.BankError('token_incorrecto');
    const c = state.cards.find((x) => x.id === cardId);
    if (!c) throw new L.BankError('tarjeta_no_existe');
    return { number: c.number, cvv: c.cvv };
  },
  changePassword: async (state, current, next, confirm) => L.changePassword(state, current, next, confirm),
};

interface StateResponse { state: BankState; version: number }

const bffGateway: BankGateway = {
  mode: 'bff',
  async login(_state, username, password) {
    try {
      const t = await api<{ accessToken: string; refreshToken: string; expiresIn: number }>('POST', '/v1/auth/login', { auth: false, body: { username, password } });
      await saveTokens({ accessToken: t.accessToken, refreshToken: t.refreshToken, expiresAt: Date.now() + t.expiresIn * 1000 });
    } catch (e) {
      if (e instanceof L.BankError && e.code === 'credenciales_invalidas') return { state: null, error: e.code };
      throw e;
    }
    return { state: (await api<StateResponse>('GET', '/v1/me')).state, error: null };
  },
  async restore() {
    try { return (await api<StateResponse>('GET', '/v1/me')).state; } catch { return null; }
  },
  logout: () => saveTokens(null),
  async execute(_state, command) {
    const domain = COMMAND_DOMAINS[command.name];
    return (await api<StateResponse>('POST', `/v1/${domain}/commands`, { body: command, idempotencyKey: newIdempotencyKey() })).state;
  },
  refresh: async () => (await api<StateResponse>('GET', '/v1/me')).state,
  revealCard: (_state, cardId, otp) => api('POST', `/v1/cards/${encodeURIComponent(cardId)}/reveal`, { body: { otp } }),
  async changePassword(_state, current, next, confirm) {
    await api('POST', '/v1/auth/password', { body: { current, next, confirm } });
    return (await api<StateResponse>('GET', '/v1/me')).state;
  },
};

export const gateway: BankGateway = MODE === 'bff' ? bffGateway : localGateway;
