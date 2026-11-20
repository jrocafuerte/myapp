import { router } from 'expo-router';
import React from 'react';
import { featureById } from '../features/registry';
import { Icon, Inline, Stack, Surface, Text } from './kit';

const COLUMNS = 4;
const chunk = <V,>(a: V[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Grilla de accesos a funcionalidades (4 columnas iguales). */
export function FeatureGrid({ ids }: { ids: string[] }) {
  return (
    <Stack gap="lg">
      {chunk(ids, COLUMNS).map((row) => (
        <Inline key={row.join()} align="start">
          {[...row, ...Array<string>(COLUMNS - row.length).fill('')].map((id, i) => <Tile key={id || `vacio-${i}`} id={id} />)}
        </Inline>
      ))}
    </Stack>
  );
}

function Tile({ id }: { id: string }) {
  const f = id ? featureById(id) : undefined;
  return (
    <Stack flex>
      {f ? (
        <Surface onPress={() => router.push(`/feature/${f.id}`)} accessibilityLabel={f.title} align="center" gap="xs" radius="md">
          <Surface background="primarySoft" radius="lg" padding="md">
            <Icon name={f.icon} size="lg" tone="primary" />
          </Surface>
          <Text variant="micro" align="center">{f.title}</Text>
        </Surface>
      ) : null}
    </Stack>
  );
}
