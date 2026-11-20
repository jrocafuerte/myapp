/**
 * Descarga la configuración remota, la valida y la guarda para la próxima apertura.
 *
 * Orden de prioridad: configuración remota recién descargada → última versión válida guardada
 * en el dispositivo → valores que trae la app. La app nunca espera a la red para abrir:
 * arranca con lo guardado y se actualiza cuando llega la versión nueva.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_MESSAGES, formatMessage, type MessageCode, type MessageParams } from './messages';
import { fetchRemoteConfig } from './fetch';
import { EMPTY_CONFIG, findMaintenance, validateRemoteConfig, type RemoteConfig } from './schema';

export const REMOTE_CONFIG_URL = process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL ?? '';
const CACHE_KEY = 'banco-plus-remote-config-v1';
const REFRESH_EVERY_MS = 5 * 60 * 1000;

type Source = 'app' | 'cache' | 'remote';
interface Ctx {
  config: RemoteConfig;
  source: Source;
  ready: boolean;
  refresh: () => Promise<void>;
  /** Fuerza la hora usada para ventanas de mantenimiento (se reevalúa cada minuto). */
  now: number;
}
const RemoteConfigContext = createContext<Ctx>({ config: EMPTY_CONFIG, source: 'app', ready: true, refresh: async () => {}, now: Date.now() });

export function RemoteConfigProvider({ children, url = REMOTE_CONFIG_URL }: { children: React.ReactNode; url?: string }) {
  const [config, setConfig] = useState<RemoteConfig>(EMPTY_CONFIG);
  const [source, setSource] = useState<Source>('app');
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    inFlight.current ??= (async () => {
      const remote = await fetchRemoteConfig(url);
      if (remote) {
        setConfig(remote); setSource('remote');
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)).catch(() => {});
      }
      setNow(Date.now());
    })().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [url]);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { config: c } = validateRemoteConfig(JSON.parse(cached));
          if (c !== EMPTY_CONFIG) { setConfig(c); setSource('cache'); }
        }
      } catch { /* caché dañada: seguimos con los valores de la app */ }
      setReady(true);
      refresh();
    })();
    const interval = setInterval(refresh, REFRESH_EVERY_MS);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(interval); clearInterval(tick); sub.remove(); };
  }, [refresh]);

  const value = useMemo(() => ({ config, source, ready, refresh, now }), [config, source, ready, refresh, now]);
  return <RemoteConfigContext.Provider value={value}>{children}</RemoteConfigContext.Provider>;
}

export const useRemoteConfig = () => useContext(RemoteConfigContext);

/** Texto de un código de error, con el reemplazo remoto si existe. */
export function messageText(config: RemoteConfig, code: MessageCode, params?: MessageParams) {
  return formatMessage(config.messages?.[code] ?? DEFAULT_MESSAGES[code], params);
}
export function useMessage() {
  const { config } = useRemoteConfig();
  return useCallback((code: MessageCode, params?: MessageParams) => messageText(config, code, params), [config]);
}

/** Mantenimiento vigente para una funcionalidad, un módulo o toda la app. */
export function useMaintenance(target: { featureId?: string; moduleId?: string } = {}) {
  const { config, now } = useRemoteConfig();
  return findMaintenance(config, target, now);
}
