/**
 * Puente del lado del micro frontend. Detecta dónde corre y habla el contrato
 * de shared/pagos-mfe/protocol.ts con el host:
 *  - native: dentro de la WebView de la app (window.ReactNativeWebView)
 *  - web: dentro de un iframe de la app web (postMessage restringido por origen)
 *  - standalone: abierto directo en un navegador (solo con datos de ejemplo en desarrollo)
 */
import {
  envelope, parseHostMessage, type HostContext, type HostMessage, type MfeMessage, type Operation, type Receipt,
} from '../../../shared/pagos-mfe/protocol';

export type EmbedMode = 'native' | 'web' | 'standalone';
type RNWindow = Window & { ReactNativeWebView?: { postMessage: (data: string) => void }; __bancoPlusReceive?: (json: string) => void };

/** Orígenes de la app web autorizados a alojar este micro frontend. */
const HOST_ORIGINS = (process.env.NEXT_PUBLIC_HOST_ORIGINS ?? 'http://localhost:8081,http://localhost:8099,http://localhost:19006')
  .split(',').map((o) => o.trim()).filter(Boolean);
const REQUEST_TIMEOUT_MS = 15000;

export function detectMode(): EmbedMode {
  const w = window as RNWindow;
  if (w.ReactNativeWebView) return 'native';
  if (w.parent && w.parent !== w) return 'web';
  return 'standalone';
}

export interface Bridge {
  mode: EmbedMode;
  send: (m: MfeMessage) => void;
  request: (op: Operation) => Promise<{ ok: true; receipt?: Receipt } | { ok: false; error: string }>;
  onContext: (fn: (c: HostContext) => void) => () => void;
  onBack: (fn: () => void) => () => void;
  dispose: () => void;
}

export function createBridge(mode: EmbedMode): Bridge {
  const w = window as RNWindow;
  let hostOrigin: string | null = null;
  const contextListeners = new Set<(c: HostContext) => void>();
  const backListeners = new Set<() => void>();
  const pending = new Map<string, (r: Awaited<ReturnType<Bridge['request']>>) => void>();

  const post = (m: MfeMessage) => {
    const json = JSON.stringify(envelope(m));
    if (mode === 'native') w.ReactNativeWebView?.postMessage(json);
    else if (mode === 'web') {
      // Hasta conocer al host solo se envía `ready`, y únicamente a orígenes autorizados.
      if (hostOrigin) w.parent.postMessage(json, hostOrigin);
      else if (m.type === 'ready') HOST_ORIGINS.forEach((o) => w.parent.postMessage(json, o));
    }
  };

  const handle = (raw: unknown, origin?: string) => {
    const msg = parseHostMessage(raw);
    if (!msg) return;
    if (mode === 'web' && origin) {
      if (!hostOrigin && msg.type === 'init') hostOrigin = origin;
      if (origin !== hostOrigin) return;
    }
    dispatch(msg);
  };

  const dispatch = (msg: HostMessage) => {
    switch (msg.type) {
      case 'init': case 'context': contextListeners.forEach((fn) => fn(msg.payload.context)); break;
      case 'response': {
        const done = pending.get(msg.payload.requestId);
        pending.delete(msg.payload.requestId);
        done?.(msg.payload.ok ? { ok: true, receipt: msg.payload.receipt } : { ok: false, error: msg.payload.error });
        break;
      }
      case 'back': backListeners.forEach((fn) => fn()); break;
    }
  };

  const onWindowMessage = (e: MessageEvent) => {
    if (e.source !== w.parent || !HOST_ORIGINS.includes(e.origin)) return;
    handle(e.data, e.origin);
  };
  if (mode === 'native') w.__bancoPlusReceive = (json) => handle(json);
  if (mode === 'web') window.addEventListener('message', onWindowMessage);

  let seq = 0;
  return {
    mode,
    send: post,
    request: (op) => new Promise((resolve) => {
      const requestId = `r${Date.now().toString(36)}${(seq++).toString(36)}`;
      const timer = setTimeout(() => { pending.delete(requestId); resolve({ ok: false, error: 'La app no respondió. Intentá de nuevo.' }); }, REQUEST_TIMEOUT_MS);
      pending.set(requestId, (r) => { clearTimeout(timer); resolve(r); });
      post({ type: 'request', payload: { requestId, op } });
    }),
    onContext: (fn) => { contextListeners.add(fn); return () => contextListeners.delete(fn); },
    onBack: (fn) => { backListeners.add(fn); return () => backListeners.delete(fn); },
    dispose: () => {
      window.removeEventListener('message', onWindowMessage);
      if (w.__bancoPlusReceive) delete w.__bancoPlusReceive;
      pending.clear(); contextListeners.clear(); backListeners.clear();
    },
  };
}
