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
