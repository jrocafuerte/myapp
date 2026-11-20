import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { useMaintenance } from '../../remote-config/RemoteConfigProvider';
import { TxDetail } from '../../features/modules/accounts';

export default function TxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const maintenance = useMaintenance({ moduleId: 'movimientos' });
  return <MaintenanceGate entry={maintenance}><TxDetail txId={String(id)} /></MaintenanceGate>;
}
