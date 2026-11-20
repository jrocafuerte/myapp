import React from 'react';
import { FeatureGrid } from '../../ui/FeatureTile';
import { Card, H, Screen } from '../../ui/kit';
import { FEATURES } from '../../features/registry';

const ids = (m: string) => FEATURES.filter((f) => f.module === m).map((f) => f.id);

export default function Payments() {
  return (
    <Screen>
      <Card><H>Transferencias</H><FeatureGrid ids={ids('transferencias')} /></Card>
      <Card><H>Pagos</H><FeatureGrid ids={ids('pagos')} /></Card>
    </Screen>
  );
}
