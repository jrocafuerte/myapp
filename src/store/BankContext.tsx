/**
 * Estado del banco en la app. Todas las operaciones pasan por el gateway:
 *  - modo local (sin EXPO_PUBLIC_BFF_URL): la lógica corre en el teléfono con datos de demostración;
 *  - modo BFF: cada comando va a la API en AWS y el servidor devuelve el estado actualizado.
 * Las pantallas no distinguen el modo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { setSessionExpiredHandler } from '../api/client';
import { gateway } from '../api/gateway';
import { messageText, useRemoteConfig } from '../remote-config/RemoteConfigProvider';
import type { Command } from './commands';
import { BankError, matureDeposits, processBills, recordLogin, runScheduled, tickMarket } from './logic';
import { createSeed } from './seed';
import type { BankState } from './types';

const STORAGE_KEY = 'banco-plus-state-v1';
const BFF_REFRESH_MS = 60_000;

interface Ctx {
  state: BankState;
  ready: boolean;
  authenticated: boolean;
  mode: 'local' | 'bff';
  /** Ejecuta un comando; devuelve null si salió bien o el mensaje de error para el usuario. */
  run: (command: Command) => Promise<string | null>;
  /** Igual que run, pero también devuelve el estado resultante (p. ej. para armar un comprobante). */
  runCommand: (command: Command) => Promise<{ error: string | null; state: BankState }>;
  /** Tareas que no son comandos (contraseña, ver datos de tarjeta): normaliza el error igual que run. */
  attempt: <T>(task: () => Promise<T>) => Promise<{ error: string | null; value?: T }>;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => void;
  /** Solo modo local: ingreso con PIN o biometría (en modo BFF requiere vincular el dispositivo con el servidor). */
  quickUnlock: (method: 'PIN' | 'biometría') => void;
  replace: (s: BankState) => void;
  reset: () => void;
  touch: () => void;
  dark: boolean;
}

const BankContext = createContext<Ctx | null>(null);

export function BankProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BankState>(createSeed);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticatedRaw] = useState(false);
  const lastActivity = useRef(Date.now());
  const scheme = useColorScheme();
  const { config: remote } = useRemoteConfig();
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const stateRef = useRef(state);
  stateRef.current = state;
  const local = gateway.mode === 'local';

  const commit = useCallback((s: BankState) => { stateRef.current = s; setState(s); }, []);
  const toMessage = useCallback((e: unknown) => {
    if (e instanceof BankError) return messageText(remoteRef.current, e.code, e.params);
    console.error(e);
    return messageText(remoteRef.current, 'error_inesperado');
  }, []);

  const signOut = useCallback(() => {
    setAuthenticatedRaw(false);
    if (!local) { gateway.logout(); commit(createSeed()); } // en modo BFF no queda información bancaria en el teléfono
  }, [local, commit]);

  // Carga inicial. Local: datos guardados + procesos automáticos. BFF: restaura la sesión si hay token.
  useEffect(() => {
    setSessionExpiredHandler(() => setAuthenticatedRaw(false));
    (async () => {
      if (local) {
        let s = createSeed();
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) { const parsed = JSON.parse(raw) as BankState; if (parsed.version === s.version) s = parsed; }
        } catch { /* almacenamiento no disponible: usamos datos demo */ }
        commit(matureDeposits(processBills(runScheduled(s))));
      } else {
        const restored = await gateway.restore();
        if (restored) { commit(restored); setAuthenticatedRaw(true); }
      }
      setReady(true);
    })();
  }, [local, commit]);

  // Solo en modo local los datos se guardan en el teléfono (son de demostración).
  useEffect(() => {
    if (ready && local) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready, local]);

  // Local: cotizaciones simuladas. BFF: refresco periódico y al volver a la app.
  useEffect(() => {
    if (!authenticated) return;
    if (local) {
      const t = setInterval(() => commit(tickMarket(stateRef.current)), 8000);
      return () => clearInterval(t);
    }
    const pull = () => gateway.refresh(stateRef.current).then(commit).catch(() => {});
    const t = setInterval(pull, BFF_REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') pull(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [authenticated, local, commit]);

  // Cierre de sesión automático por inactividad o al pasar a segundo plano
  useEffect(() => {
    if (!authenticated) return;
    const limitMs = state.settings.autoLockMinutes * 60000;
    const t = setInterval(() => { if (limitMs > 0 && Date.now() - lastActivity.current > limitMs) signOut(); }, 5000);
    let backgroundAt = 0;
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') backgroundAt = Date.now();
      else if (backgroundAt && limitMs > 0 && Date.now() - backgroundAt > limitMs) signOut();
    });
    return () => { clearInterval(t); sub.remove(); };
  }, [authenticated, state.settings.autoLockMinutes, signOut]);

  const touch = useCallback(() => { lastActivity.current = Date.now(); }, []);

  const runCommand = useCallback(async (command: Command) => {
    touch();
    try {
      const next = await gateway.execute(stateRef.current, command);
      commit(next);
      return { error: null, state: next };
    } catch (e) {
      return { error: toMessage(e), state: stateRef.current };
    }
  }, [touch, commit, toMessage]);

  const run = useCallback(async (command: Command) => (await runCommand(command)).error, [runCommand]);

  const attempt = useCallback(async <T,>(task: () => Promise<T>) => {
    touch();
    try { return { error: null, value: await task() }; } catch (e) { return { error: toMessage(e) }; }
  }, [touch, toMessage]);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const { state: next, error } = await gateway.login(stateRef.current, username, password);
      if (next) commit(next);
      if (error) return messageText(remoteRef.current, error);
      touch();
      setAuthenticatedRaw(true);
      return null;
    } catch (e) {
      return toMessage(e);
    }
  }, [commit, touch, toMessage]);

  const dark = state.settings.darkMode === 'oscuro' || (state.settings.darkMode === 'sistema' && scheme === 'dark');

  const value = useMemo<Ctx>(() => ({
    state, ready, authenticated, run, runCommand, attempt, signIn, signOut, touch, dark, mode: gateway.mode,
    replace: commit,
    quickUnlock: (method) => { if (!local) return; commit(recordLogin(stateRef.current, method)); touch(); setAuthenticatedRaw(true); },
    reset: () => { commit(createSeed()); signOut(); },
  }), [state, ready, authenticated, run, runCommand, attempt, signIn, signOut, touch, dark, commit, local]);

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank() {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error('useBank debe usarse dentro de BankProvider');
  return ctx;
}
