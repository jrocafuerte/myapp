import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useCatalog } from '../../features/registry';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { EmptyState, Screen } from '../../ui/kit';

export default function FeatureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feature = useCatalog().byId.get(String(id));
  // No existe o la configuración remota la ocultó.
  if (!feature) return <Screen><Stack.Screen options={{ title: 'No disponible' }} /><EmptyState text="Esta funcionalidad no está disponible." /></Screen>;
  const { Component } = feature;
  return (
    <>
      <Stack.Screen options={{ title: feature.title }} />
      <MaintenanceGate entry={feature.maintenance}><Component /></MaintenanceGate>
    </>
  );
}
