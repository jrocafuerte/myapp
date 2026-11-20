import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { BankError, matureDeposits, processBills, runScheduled, tickMarket } from './logic';
import { createSeed } from './seed';
import type { BankState } from './types';

const STORAGE_KEY = 'banco-plus-state-v1';

type Op = (s: BankState) => BankState;

interface Ctx {
  state: BankState;
  ready: boolean;
  authenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  /** Aplica una operación; devuelve null si salió bien o el mensaje de error. */
  run: (op: Op) => string | null;
  replace: (s: BankState) => void;
  reset: () => void;
  touch: () => void;
  dark: boolean;
}

const BankContext = createContext<Ctx | null>(null);

export function BankProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BankState>(createSeed);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const lastActivity = useRef(Date.now());
  const scheme = useColorScheme();

  // Carga inicial + procesos automáticos (programadas, débitos, vencimientos de plazo fijo)
  useEffect(() => {
    (async () => {
      let s = createSeed();
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) { const parsed = JSON.parse(raw) as BankState; if (parsed.version === s.version) s = parsed; }
      } catch { /* almacenamiento no disponible: usamos datos demo */ }
      s = matureDeposits(processBills(runScheduled(s)));
      setState(s);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  // Cotizaciones de mercado en "tiempo real" (simuladas)
  useEffect(() => {
    if (!authenticated) return;
    const t = setInterval(() => setState((s) => tickMarket(s)), 8000);
    return () => clearInterval(t);
  }, [authenticated]);

  // Cierre de sesión automático por inactividad o al pasar a segundo plano
  useEffect(() => {
    if (!authenticated) return;
    const limitMs = state.settings.autoLockMinutes * 60000;
    const t = setInterval(() => { if (limitMs > 0 && Date.now() - lastActivity.current > limitMs) setAuthenticated(false); }, 5000);
    let backgroundAt = 0;
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') backgroundAt = Date.now();
      else if (backgroundAt && limitMs > 0 && Date.now() - backgroundAt > limitMs) setAuthenticated(false);
    });
    return () => { clearInterval(t); sub.remove(); };
  }, [authenticated, state.settings.autoLockMinutes]);

  const touch = useCallback(() => { lastActivity.current = Date.now(); }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const run = useCallback((op: Op) => {
    touch();
    try {
      const next = op(stateRef.current);
      stateRef.current = next;
      setState(next);
      return null;
    } catch (e) {
      if (e instanceof BankError) return e.message;
      console.error(e);
      return 'Ocurrió un error inesperado.';
    }
  }, [touch]);

  const dark = state.settings.darkMode === 'oscuro' || (state.settings.darkMode === 'sistema' && scheme === 'dark');

  const value = useMemo<Ctx>(() => ({
    state, ready, authenticated, run, touch, dark,
    setAuthenticated: (v) => { touch(); setAuthenticated(v); },
    replace: (s) => { stateRef.current = s; setState(s); },
    reset: () => { const s = createSeed(); stateRef.current = s; setState(s); setAuthenticated(false); },
  }), [state, ready, authenticated, run, touch, dark]);

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank() {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error('useBank debe usarse dentro de BankProvider');
  return ctx;
}
