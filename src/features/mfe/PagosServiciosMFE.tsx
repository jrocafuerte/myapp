/**
 * Pantalla nativa que aloja el micro frontend de Pago de servicios (Next.js).
 * La app sigue siendo la dueña de los datos: envía el contexto, ejecuta las operaciones
 * con la lógica de negocio de siempre y aporta lo nativo (título, atrás, vibración, compartir).
 */
import * as Haptics from 'expo-haptics';
import { Stack as Router, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Share } from 'react-native';
import { envelope, mfeUrl, parseMfeMessage, type HostMessage, type RouteKey } from '../../../shared/pagos-mfe/protocol';
import { useBank } from '../../store/BankContext';
import { Button, EmptyState, Spinner, Stack, Text, useTheme } from '../../ui/kit';
import { EmbeddedView, type EmbeddedHandle } from './EmbeddedView';
import { buildContext, receiptFrom, themeSnapshot, toCommand } from './pagosHost';

/** URL donde está publicado el micro frontend. En desarrollo: `npm run dev` dentro de mfe/pagos-servicios. */
export const PAGOS_MFE_URL = process.env.EXPO_PUBLIC_PAGOS_MFE_URL ?? 'http://localhost:3001';
const LOAD_TIMEOUT_MS = 15000;

type Status = 'loading' | 'ready' | 'error';

export function PagosServiciosMFE({ route, fallbackTitle }: { route: RouteKey; fallbackTitle: string }) {
  const { state, runCommand, touch } = useBank();
  const stateRef = useRef(state);
  stateRef.current = state;
  const theme = useTheme();
  const view = useRef<EmbeddedHandle>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [title, setTitle] = useState(fallbackTitle);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);

  const origin = useMemo(() => new URL(PAGOS_MFE_URL).origin, []);
  // La URL se fija al montar (y en cada reintento) para no recargar el micro frontend al cambiar de tema.
  const url = useMemo(() => mfeUrl(PAGOS_MFE_URL, route, { embed: Platform.OS === 'web' ? 'web' : 'native', dark: theme.dark }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, attempt]);

  const send = useCallback((m: HostMessage) => view.current?.send(JSON.stringify(envelope(m))), []);
  const context = useMemo(() => buildContext(state, themeSnapshot(theme)), [state, theme]);
  const contextRef = useRef(context);
  contextRef.current = context;

  // Mantiene el micro frontend sincronizado con la app (saldos, servicios, tema, privacidad).
  useEffect(() => { if (ready.current) send({ type: 'context', payload: { context } }); }, [context, send]);

  // Si no responde a tiempo, mostramos el estado de error nativo.
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setStatus((s) => (s === 'loading' ? 'error' : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status, attempt]);

  const onMessage = useCallback((raw: string) => {
    const msg = parseMfeMessage(raw);
    if (!msg) return; // mensajes que no cumplen el contrato se ignoran
    touch();
    switch (msg.type) {
      case 'ready':
        ready.current = true;
        send({ type: 'init', payload: { context: contextRef.current } });
        setStatus('ready');
        break;
      case 'request': {
        const { requestId, op } = msg.payload;
        const before = stateRef.current;
        runCommand(toCommand(op)).then(({ error, state: after }) => {
          const receipt = error ? undefined : receiptFrom(before, after, op);
          Haptics.notificationAsync(error ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
          send({ type: 'response', payload: error ? { requestId, ok: false, error } : { requestId, ok: true, receipt } });
        });
        break;
      }
      case 'title': setTitle(msg.payload.title); break;
      case 'haptic':
        if (msg.payload.kind === 'selection') Haptics.selectionAsync().catch(() => {});
        else Haptics.notificationAsync(msg.payload.kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
      case 'share': Share.share({ message: msg.payload.message }).catch(() => {}); break;
      case 'close': if (router.canGoBack()) router.back(); break;
    }
  }, [runCommand, send, touch]);

  // Botón atrás de Android: primero navega dentro del micro frontend; en su raíz, cierra la pantalla.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!ready.current) return false;
      send({ type: 'back', payload: {} });
      return true;
    });
    return () => sub.remove();
  }, [send]));

  const retry = () => { ready.current = false; setStatus('loading'); setAttempt((a) => a + 1); };

  return (
    <Stack flex background="bg">
      <Router.Screen options={{ title }} />
      {status === 'error' ? (
        <Stack flex justify="center" padding="xl" gap="md">
          <EmptyState icon="cloud-offline-outline" text="No pudimos abrir Pago de servicios. Revisá tu conexión e intentá de nuevo." />
          <Button title="Reintentar" icon="refresh" onPress={retry} />
        </Stack>
      ) : (
        <Stack flex>
          <EmbeddedView key={attempt} ref={view} url={url} origin={origin} background={theme.colors.bg} onMessage={onMessage} onLoadError={() => setStatus('error')} />
          {status === 'loading' ? (
            <Stack overlay align="center" justify="center" gap="sm" background="bg">
              <Spinner />
              <Text tone="muted" variant="bodySmall">Cargando Pago de servicios…</Text>
            </Stack>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

