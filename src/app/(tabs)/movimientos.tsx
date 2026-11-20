import React from 'react';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { useMaintenance } from '../../remote-config/RemoteConfigProvider';
import { MovementsBrowser } from '../../features/modules/accounts';

export default function Movements() {
  const maintenance = useMaintenance({ moduleId: 'movimientos' });
  return <MaintenanceGate entry={maintenance}><MovementsBrowser /></MaintenanceGate>;
}
