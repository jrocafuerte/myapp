/** Persistencia en memoria: desarrollo local y tests. */
import type { BankState } from '../../../shared/domain/types';
import { ConflictError, type IdempotencyBegin, type StateStore, type StoredState } from './types';

export class MemoryStore implements StateStore {
  private states = new Map<string, StoredState>();
  private idem = new Map<string, { fingerprint: string; statusCode?: number; body?: string }>();

  async get(userId: string) { const s = this.states.get(userId); return s ? structuredClone(s) : null; }
  async put(userId: string, state: BankState, expected: number | null) {
    const current = this.states.get(userId);
    if ((current?.version ?? null) !== expected) throw new ConflictError();
    const version = (expected ?? 0) + 1;
    this.states.set(userId, { state: structuredClone(state), version });
    return version;
  }
  async *listUserIds() { yield* this.states.keys(); }
  async beginIdempotent(userId: string, key: string, fingerprint: string): Promise<IdempotencyBegin> {
    const k = `${userId}#${key}`; const rec = this.idem.get(k);
    if (!rec) { this.idem.set(k, { fingerprint }); return { status: 'new' }; }
    if (rec.fingerprint !== fingerprint) return { status: 'mismatch' };
    return rec.body !== undefined ? { status: 'done', statusCode: rec.statusCode!, body: rec.body } : { status: 'pending' };
  }
  async completeIdempotent(userId: string, key: string, statusCode: number, body: string) {
    const k = `${userId}#${key}`; const rec = this.idem.get(k);
    if (rec) Object.assign(rec, { statusCode, body });
  }
  async abortIdempotent(userId: string, key: string) { this.idem.delete(`${userId}#${key}`); }
}
