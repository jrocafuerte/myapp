import { useMemo } from 'react';
import { useRemoteConfig } from '../remote-config/RemoteConfigProvider';
import { findMaintenance, type MaintenanceEntry, type RemoteConfig } from '../remote-config/schema';
import { accountFeatures } from './modules/accounts';
import { cardFeatures } from './modules/cards';
import { investFeatures } from './modules/invest';
import { profileFeatures } from './modules/profile';
import { savingsFeatures } from './modules/savings';
import { securityFeatures } from './modules/security';
import { transferFeatures } from './modules/transfers';
import { MODULES, type Feature, type ModuleId } from './types';

/** Catálogo completo de funcionalidades de la app (117). */
export const FEATURES: Feature[] = [
  ...securityFeatures, ...accountFeatures, ...transferFeatures, ...cardFeatures,
  ...savingsFeatures, ...investFeatures, ...profileFeatures,
];

export const featureById = (id: string) => FEATURES.find((f) => f.id === id);

export const featuresByModule = () =>
  (Object.keys(MODULES) as ModuleId[]).map((m) => ({ module: m, ...MODULES[m], features: FEATURES.filter((f) => f.module === m) }));

/* ---------------------- catálogo con la configuración remota ---------------------- */

export interface ResolvedFeature extends Feature { maintenance?: MaintenanceEntry }
export interface ResolvedModule { module: ModuleId; title: string; icon: Feature['icon']; features: ResolvedFeature[] }

/**
 * Aplica la configuración remota al menú: nombres y descripciones, ocultos y mantenimiento.
 * Una funcionalidad oculta (o de un módulo oculto) desaparece del menú y de los accesos rápidos.
 */
export function resolveCatalog(config: RemoteConfig, now = Date.now()) {
  const modules: ResolvedModule[] = (Object.keys(MODULES) as ModuleId[])
    .filter((m) => !config.modules?.[m]?.hidden)
    .map((m) => ({
      module: m,
      icon: MODULES[m].icon,
      title: config.modules?.[m]?.title ?? MODULES[m].title,
      features: FEATURES.filter((f) => f.module === m && !config.features?.[f.id]?.hidden).map((f) => ({
        ...f,
        title: config.features?.[f.id]?.title ?? f.title,
        description: config.features?.[f.id]?.description ?? f.description,
        maintenance: findMaintenance(config, { featureId: f.id, moduleId: m }, now),
      })),
    }))
    .filter((g) => g.features.length);
  const byId = new Map(modules.flatMap((g) => g.features.map((f) => [f.id, f] as const)));
  return { modules, byId, count: byId.size };
}

export function useCatalog() {
  const { config, now } = useRemoteConfig();
  return useMemo(() => resolveCatalog(config, now), [config, now]);
}
