/**
 * Adaptador SIMULADO del banco: guarda el estado de cada cliente en DynamoDB y aplica la misma
 * lógica de negocio que la app (shared/domain). Sirve para desarrollar y probar el flujo completo
 * antes de tener las APIs reales, y como referencia de comportamiento para ellas.
 */
import { randomBytes } from 'node:crypto';
import { applyCommand, type Command } from '../../../shared/domain/commands';
import { BankError } from '../../../shared/domain/logic';
import { createSeed } from '../../../shared/domain/seed';
import type { BankState } from '../../../shared/domain/types';
import type { AuthProvider } from '../auth/provider';
import { ConflictError, type StateStore } from '../store/types';
import type { Customer, DomainAdapter, SnapshotProvider } from './port';

const MAX_RETRIES = 3;

export class SimulatedCore implements DomainAdapter, SnapshotProvider {
  readonly domain = '*' as const;
  constructor(private store: StateStore, private auth: AuthProvider) {}

  /** Alta automática: el primer acceso de un cliente crea su cartera de demostración. */
  private onboard(c: Customer): BankState {
    const s = createSeed();
    s.user.username = c.username;
    if (c.email) s.user.email = c.email;
    // La credencial real vive en el proveedor de identidad; aquí se guarda un valor aleatorio interno.
    s.user.password = randomBytes(24).toString('base64url');
    s.devices = s.devices.filter((d) => d.current);
    return s;
  }

  async snapshot(c: Customer) {
    const found = await this.store.get(c.userId);
    if (found) return found;
    const state = this.onboard(c);
    try {
      return { state, version: await this.store.put(c.userId, state, null) };
    } catch (e) {
      if (e instanceof ConflictError) return (await this.store.get(c.userId))!; // alta concurrente
      throw e;
    }
  }

  /** Reglas que solo el servidor puede aplicar antes de ejecutar un comando. */
  private async prepare(c: Customer, state: BankState, command: Command): Promise<Command> {
    if (command.name === 'setEmergencyLock' && command.args[0] === false) {
      const ok = await this.auth.verifyPassword(c.username, String(command.args[1] ?? ''));
      if (!ok) throw new BankError('contrasena_incorrecta');
      return { name: 'setEmergencyLock', args: [false, state.user.password] };
    }
    return command;
  }

  async execute(c: Customer, command: Command) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { state, version } = await this.snapshot(c);
      const next = applyCommand(state, await this.prepare(c, state, command));
      try {
        await this.store.put(c.userId, next, version);
        return;
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e; // otro request cambió el estado: se reintenta sobre el nuevo
      }
    }
    throw new BankError('conflicto_version');
  }

  /** Procesos diarios (EventBridge): programadas, débitos automáticos y vencimientos de plazo fijo. */
  async runDaily(userId: string, process: (s: BankState) => BankState) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const found = await this.store.get(userId);
      if (!found) return;
      try { await this.store.put(userId, process(found.state), found.version); return; } catch (e) { if (!(e instanceof ConflictError)) throw e; }
    }
  }
}
