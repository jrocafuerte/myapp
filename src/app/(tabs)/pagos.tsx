import React from 'react';
import { useCatalog } from '../../features/registry';
import { FeatureGrid } from '../../ui/FeatureTile';
import { Card, Screen, Text } from '../../ui/kit';

export default function Payments() {
  const { modules } = useCatalog();
  return (
    <Screen>
      {modules.filter((g) => g.module === 'transferencias' || g.module === 'pagos').map((g) => (
        <Card key={g.module}><Text variant="heading">{g.title}</Text><FeatureGrid ids={g.features.map((f) => f.id)} /></Card>
      ))}
    </Screen>
  );
}
