/**
 * Registro de adaptadores por dominio. Para pasar un dominio a la API real del banco:
 *   1. Crea src/core/<dominio>.ts implementando DomainAdapter (llamando a la API del banco).
 *   2. Agrégalo en `REAL_ADAPTERS`. Los demás dominios siguen en el simulado.
 *   3. Si el dominio deja de vivir en el simulado, también su parte del snapshot debe leerse
 *      del servicio real (ver SnapshotProvider).
 */
import type { Domain } from '../../../shared/domain/commands';
import type { DomainAdapter } from './port';
import type { SimulatedCore } from './simulated';

const REAL_ADAPTERS: Partial<Record<Domain, DomainAdapter>> = {
  // transfers: new TransfersApiAdapter(process.env.TRANSFERS_API_URL!),
};

export const adapterFor = (domain: Domain, simulated: SimulatedCore): DomainAdapter => REAL_ADAPTERS[domain] ?? simulated;
