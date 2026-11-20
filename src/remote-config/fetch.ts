/** Descarga de la configuración remota, sin dependencias de React Native (testeable en Node). */
import { EMPTY_CONFIG, validateRemoteConfig, type RemoteConfig } from './schema';

const TIMEOUT_MS = 6000;
export const MAX_BYTES = 256 * 1024;

/** Descarga y valida. Devuelve null si no hay URL, falla la red o el documento no sirve. */
export async function fetchRemoteConfig(url: string, fetcher: typeof fetch = fetch): Promise<RemoteConfig | null> {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.length > MAX_BYTES) return null;
    const { config, errors } = validateRemoteConfig(JSON.parse(body));
    if (errors.length && typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[remote-config] entradas descartadas:\n' + errors.join('\n'));
    return config === EMPTY_CONFIG ? null : config;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

