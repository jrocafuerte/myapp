import type React from 'react';
import type { IconName } from '../ui/kit';

export type ModuleId =
  | 'seguridad' | 'cuentas' | 'movimientos' | 'transferencias' | 'pagos' | 'tarjetas' | 'ahorro'
  | 'prestamos' | 'inversiones' | 'seguros' | 'notificaciones' | 'perfil' | 'soporte';

export interface Feature {
  id: string;
  module: ModuleId;
  title: string;
  description: string;
  icon: IconName;
  Component: React.ComponentType;
}

export const MODULES: Record<ModuleId, { title: string; icon: IconName }> = {
  seguridad: { title: 'Seguridad y acceso', icon: 'shield-checkmark' },
  cuentas: { title: 'Cuentas', icon: 'wallet' },
  movimientos: { title: 'Movimientos', icon: 'list' },
  transferencias: { title: 'Transferencias', icon: 'swap-horizontal' },
  pagos: { title: 'Pagos', icon: 'receipt' },
  tarjetas: { title: 'Tarjetas', icon: 'card' },
  ahorro: { title: 'Ahorro y presupuesto', icon: 'pie-chart' },
  prestamos: { title: 'Préstamos', icon: 'cash' },
  inversiones: { title: 'Inversiones', icon: 'trending-up' },
  seguros: { title: 'Seguros', icon: 'umbrella' },
  notificaciones: { title: 'Notificaciones', icon: 'notifications' },
  perfil: { title: 'Perfil y configuración', icon: 'person-circle' },
  soporte: { title: 'Ayuda y soporte', icon: 'help-buoy' },
};
