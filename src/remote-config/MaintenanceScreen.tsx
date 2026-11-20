import { router } from 'expo-router';
import React, { useState } from 'react';
import { Button, Icon, Stack, Text } from '../ui/kit';
import { date } from '../utils/format';
import { useRemoteConfig } from './RemoteConfigProvider';
import type { MaintenanceEntry } from './schema';

/** Pantalla de mantenimiento definida desde la configuración remota. */
export function MaintenanceScreen({ entry, canGoBack = true }: { entry: MaintenanceEntry; canGoBack?: boolean }) {
  const { refresh } = useRemoteConfig();
  const [checking, setChecking] = useState(false);
  return (
    <Stack flex justify="center" align="stretch" padding="xl" gap="lg" background="bg">
      <Stack align="center" gap="md">
        <Icon name="construct-outline" size="xl" tone="primary" />
        <Text variant="headline" align="center">{entry.title ?? 'Estamos en mantenimiento'}</Text>
        <Text tone="muted" align="center">{entry.message}</Text>
        {entry.until ? <Text variant="bodySmall" tone="muted" align="center">Volvemos aprox. el {date(entry.until, true)}</Text> : null}
      </Stack>
      <Button title="Reintentar" icon="refresh" variant="secondary" loading={checking}
        onPress={async () => { setChecking(true); await refresh(); setChecking(false); }} />
      {canGoBack && router.canGoBack() ? <Button title="Volver" variant="ghost" onPress={() => router.back()} /> : null}
    </Stack>
  );
}

/** Muestra la pantalla de mantenimiento si aplica a esta funcionalidad o módulo; si no, el contenido. */
export function MaintenanceGate({ entry, children }: { entry: MaintenanceEntry | undefined; children: React.ReactNode }) {
  return entry ? <MaintenanceScreen entry={entry} /> : <>{children}</>;
}
