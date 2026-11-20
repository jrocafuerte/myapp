import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { useMaintenance } from '../../remote-config/RemoteConfigProvider';
import { CardDetail } from '../../features/modules/cards';

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const maintenance = useMaintenance({ moduleId: 'tarjetas' });
  return <MaintenanceGate entry={maintenance}><CardDetail cardId={String(id)} /></MaintenanceGate>;
}
