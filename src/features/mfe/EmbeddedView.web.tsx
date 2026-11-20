/** Versión web (Expo web) de EmbeddedView: un iframe con postMessage restringido al origen del micro frontend. */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { EmbeddedHandle, EmbeddedProps } from './EmbeddedView';

export type { EmbeddedHandle, EmbeddedProps } from './EmbeddedView';

export const EmbeddedView = forwardRef<EmbeddedHandle, EmbeddedProps>(function EmbeddedView({ url, origin, background, onMessage, onLoadError }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  useImperativeHandle(ref, () => ({
    send: (json) => frame.current?.contentWindow?.postMessage(json, origin),
    reload: () => { if (frame.current) frame.current.src = url; },
  }), [origin, url]);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.origin === origin && e.source === frame.current?.contentWindow) onMessage(typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [origin, onMessage]);
  return React.createElement('iframe', {
    ref: frame, src: url, title: 'Pago de servicios', onError: onLoadError,
    sandbox: 'allow-scripts allow-same-origin allow-forms',
    style: { border: 0, width: '100%', height: '100%', flex: 1, background, display: 'block' },
  });
});
