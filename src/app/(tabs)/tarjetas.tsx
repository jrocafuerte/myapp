import React from 'react';
import { MaintenanceGate } from '../../remote-config/MaintenanceScreen';
import { useMaintenance } from '../../remote-config/RemoteConfigProvider';
import { CardsList } from '../../features/modules/cards';

export default function Cards() {
  const maintenance = useMaintenance({ moduleId: 'tarjetas' });
  return <MaintenanceGate entry={maintenance}><CardsList /></MaintenanceGate>;
}
