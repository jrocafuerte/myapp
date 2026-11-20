'use client';
/**
 * Conecta las páginas con el host: contexto (datos + tema), operaciones, título,
 * vibración, compartir y una pila de navegación propia para el botón atrás nativo.
 */
import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { HostContext, MfeMessage, Operation, Receipt, ThemeSnapshot } from '../../../shared/pagos-mfe/protocol';
import { createBridge, detectMode, type Bridge, type EmbedMode } from './bridge';
import { mockContext, mockExecute } from './mockHost';

type Status = 'connecting' | 'ready' | 'unavailable';
interface Ctx {
  status: Status;
  mode: EmbedMode;
  context: HostContext | null;
  request: (op: Operation) => Promise<{ ok: true; receipt?: Receipt } | { ok: false; error: string }>;
  haptic: (kind: 'selection' | 'success' | 'error') => void;
  share: (message: string) => void;
  setTitle: (title: string) => void;
  navigate: (path: string) => void;
  back: () => void;
}
const BridgeContext = createContext<Ctx | null>(null);
const STANDALONE_MOCK = process.env.NEXT_PUBLIC_STANDALONE_MOCK === '1';

/** Convierte los tokens del design system del host en variables CSS. */
function applyTheme(t: ThemeSnapshot) {
  const root = document.documentElement;
  root.dataset.theme = t.dark ? 'dark' : 'light';
  for (const [k, v] of Object.entries(t.colors)) root.style.setProperty(`--c-${k}`, v);
  for (const [k, v] of Object.entries(t.spacing)) root.style.setProperty(`--s-${k}`, `${v}px`);
  for (const [k, v] of Object.entries(t.radius)) root.style.setProperty(`--r-${k}`, `${v}px`);
  for (const [k, v] of Object.entries(t.typography)) {
    root.style.setProperty(`--fs-${k}`, `${v.fontSize}px`);
    root.style.setProperty(`--lh-${k}`, `${v.lineHeight}px`);
    root.style.setProperty(`--fw-${k}`, v.fontWeight);
  }
  root.style.setProperty('--touch', `${t.touchTarget}px`);
}

export function BridgeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('connecting');
  const [mode, setMode] = useState<EmbedMode>('standalone');
  const [context, setContext] = useState<HostContext | null>(null);
  const bridge = useRef<Bridge | null>(null);
  const depth = useRef(0);
  const contextRef = useRef<HostContext | null>(null);
  contextRef.current = context;

  useEffect(() => {
    const m = detectMode();
    setMode(m);
    if (m === 'standalone') {
      if (STANDALONE_MOCK) { setContext(mockContext(document.documentElement.dataset.theme === 'dark')); setStatus('ready'); }
      else setStatus('unavailable');
      return;
    }
    const b = createBridge(m);
    bridge.current = b;
    const off = b.onContext((c) => { setContext(c); applyTheme(c.theme); setStatus('ready'); });
    b.send({ type: 'ready', payload: { route: window.location.pathname } });
    const t = setTimeout(() => setStatus((s) => (s === 'connecting' ? 'unavailable' : s)), 10000);
    return () => { off(); clearTimeout(t); b.dispose(); bridge.current = null; };
  }, []);

  const send = useCallback((msg: MfeMessage) => bridge.current?.send(msg), []);

  const navigate = useCallback((path: string) => { depth.current += 1; send({ type: 'haptic', payload: { kind: 'selection' } }); router.push(path); }, [router, send]);
  const back = useCallback(() => {
    if (depth.current > 0) { depth.current -= 1; router.back(); }
    else send({ type: 'close', payload: {} });
  }, [router, send]);

  // El botón atrás de Android llega desde el host.
  useEffect(() => bridge.current?.onBack(back), [back, status]);
  // Al cambiar de pantalla, el foco va al título (lectores de pantalla) y el scroll arriba.
  useEffect(() => { window.scrollTo(0, 0); document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }); }, [pathname]);

  const value = useMemo<Ctx>(() => ({
    status, mode, context, navigate, back,
    request: async (op) => {
      if (bridge.current) return bridge.current.request(op);
      const r = mockExecute(contextRef.current!, op);
      if ('error' in r) return { ok: false, error: r.error };
      setContext(r.context);
      return { ok: true, receipt: r.receipt };
    },
    haptic: (kind) => send({ type: 'haptic', payload: { kind } }),
    share: (message) => {
      if (bridge.current) send({ type: 'share', payload: { message } });
      else navigator.clipboard?.writeText(message).catch(() => {});
    },
    setTitle: (title) => { document.title = title; send({ type: 'title', payload: { title } }); },
  }), [status, mode, context, navigate, back, send]);

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge() {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error('useBridge debe usarse dentro de BridgeProvider');
  return ctx;
}

/** Fija el título de la barra nativa mientras la página está visible. */
export function useTitle(title: string) {
  const { setTitle, status } = useBridge();
  useEffect(() => { if (status === 'ready') setTitle(title); }, [title, status, setTitle]);
}
