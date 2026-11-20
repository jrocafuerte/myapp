/**
 * PUERTOS hacia los servicios del banco.
 *
 * El BFF no conoce los sistemas del banco: habla con estos puertos. Hoy todos los dominios usan
 * el adaptador simulado (SimulatedCore). Para integrar un servicio real, implementa `DomainAdapter`
 * para su dominio (p. ej. 'transfers' → API de pagos del banco) y regístralo en core/index.ts.
 */
import type { Command, Domain } from '../../../shared/domain/commands';
import type { BankState } from '../../../shared/domain/types';

export interface Customer { userId: string; username: string; email?: string }

/** Ejecuta los comandos de un dominio contra el servicio del banco que corresponda. */
export interface DomainAdapter {
  readonly domain: Domain | '*';
  execute(customer: Customer, command: Command): Promise<void>;
}

/** Arma la vista del cliente (lo que la app muestra) a partir de los servicios del banco. */
export interface SnapshotProvider {
  snapshot(customer: Customer): Promise<{ state: BankState; version: number }>;
}
