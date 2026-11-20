import React from 'react';
import { FeatureGrid } from '../../ui/FeatureTile';
import {
  Card, Screen, Text,
} from '../../ui/kit';
import { FEATURES } from '../../features/registry';

const ids = (m: string) => FEATURES.filter((f) => f.module === m).map((f) => f.id);

export default function Payments() {
  return (
    <Screen>
      <Card><Text variant="heading">Transferencias</Text><FeatureGrid ids={ids('transferencias')} /></Card>
      <Card><Text variant="heading">Pagos</Text><FeatureGrid ids={ids('pagos')} /></Card>
    </Screen>
  );
}
