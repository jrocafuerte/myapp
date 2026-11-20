import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { useMaintenance } from '../../remote-config/RemoteConfigProvider';
import { AccountDetail } from '../../features/modules/accounts';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const maintenance = useMaintenance({ moduleId: 'cuentas' });
  return <MaintenanceGate entry={maintenance}><AccountDetail accountId={String(id)} /></MaintenanceGate>;
}
