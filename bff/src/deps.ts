/**
 * Dependencias según el entorno:
 *   AWS (Lambda): DynamoDB + Cognito (TABLE_NAME, USER_POOL_CLIENT_ID).
 *   Local / tests: memoria + proveedor de identidad local (BFF_ENV=local).
 */
import { CognitoAuth } from './auth/cognito';
import { LocalAuth } from './auth/local';
import type { AuthProvider } from './auth/provider';
import { SimulatedCore } from './core/simulated';
import { DynamoStore } from './store/dynamo';
import { MemoryStore } from './store/memory';
import type { StateStore } from './store/types';

export interface Deps { store: StateStore; auth: AuthProvider; core: SimulatedCore }
let deps: Deps | null = null;

export function getDeps(): Deps {
  if (deps) return deps;
  const local = process.env.BFF_ENV === 'local';
  const store: StateStore = local ? new MemoryStore() : new DynamoStore(required('TABLE_NAME'));
  const auth: AuthProvider = local ? new LocalAuth() : new CognitoAuth(required('USER_POOL_CLIENT_ID'));
  deps = { store, auth, core: new SimulatedCore(store, auth) };
  return deps;
}

/** Para tests: reemplaza las dependencias. */
export const setDeps = (d: Deps | null) => { deps = d; };

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}
