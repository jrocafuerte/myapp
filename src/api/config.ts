/** URL del BFF (API Gateway). Vacía = modo local: la lógica corre en el teléfono con datos de demostración. */
export const BFF_URL = (process.env.EXPO_PUBLIC_BFF_URL ?? '').replace(/\/+$/, '');
export const MODE: 'local' | 'bff' = BFF_URL ? 'bff' : 'local';
