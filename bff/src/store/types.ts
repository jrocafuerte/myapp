import type { BankState } from '../../../shared/domain/types';

export interface StoredState { state: BankState; version: number }

export class ConflictError extends Error { constructor() { super('version_conflict'); } }

export type IdempotencyBegin =
  | { status: 'new' }
  | { status: 'done'; statusCode: number; body: string }
  | { status: 'pending' }
  | { status: 'mismatch' };

/** Persistencia del adaptador simulado (estado por cliente) y de la idempotencia. */
export interface StateStore {
  get(userId: string): Promise<StoredState | null>;
  /** Guarda si la versión guardada sigue siendo `expected` (null = no existía). Si no, ConflictError. */
  put(userId: string, state: BankState, expected: number | null): Promise<number>;
  listUserIds(): AsyncIterable<string>;
  beginIdempotent(userId: string, key: string, fingerprint: string): Promise<IdempotencyBegin>;
  completeIdempotent(userId: string, key: string, statusCode: number, body: string): Promise<void>;
  abortIdempotent(userId: string, key: string): Promise<void>;
}

export const IDEMPOTENCY_TTL_S = 24 * 3600;
