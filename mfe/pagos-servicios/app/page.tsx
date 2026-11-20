'use client';
import { Banner, Card, Empty, ListItem, SERVICE_ICON, Screen } from '../components/ui';
import { useBridge, useTitle } from '../lib/BridgeProvider';
import { daysUntil, date, money } from '../lib/format';

/** Facturas pendientes, ordenadas por vencimiento. */
export default function Pagar() {
  useTitle('Pago de servicios');
  const { context, navigate } = useBridge();
  if (!context) return null;
  const pending = context.services.filter((s) => s.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const total = pending.reduce((a, s) => a + s.amountDue, 0);
  const overdue = pending.filter((s) => daysUntil(s.dueDate) < 0).length;
  return (
    <Screen title="Pago de servicios">
      <Card label="Resumen">
        <span className="muted">Total pendiente</span>
        <span className="t-title num">{money(total, 'USD', { hidden: context.hideBalances })}</span>
        <span className="t-caption muted">{pending.length} {pending.length === 1 ? 'factura' : 'facturas'} por pagar</span>
      </Card>
      {overdue ? <Banner kind="error" text={`Tenés ${overdue} ${overdue === 1 ? 'factura vencida' : 'facturas vencidas'}.`} /> : null}
      <Card label="Facturas">
        <h2 className="t-heading">Por pagar</h2>
        {pending.length === 0 ? <Empty icon="check" text="¡No tenés facturas pendientes!" /> : pending.map((s) => {
          const d = daysUntil(s.dueDate);
          return (
            <ListItem key={s.id} icon={SERVICE_ICON[s.type]} title={s.company}
              subtitle={`${s.type} · ${d < 0 ? `venció hace ${-d} días` : d === 0 ? 'vence hoy' : `vence ${date(s.dueDate)}`}${s.autoDebit ? ' · débito automático' : ''}`}
              right={money(s.amountDue)} rightClass={d <= 3 ? 'danger' : undefined} onPress={() => navigate(`/pagar/?id=${encodeURIComponent(s.id)}`)} />
          );
        })}
      </Card>
      <Card label="Más opciones">
        <ListItem icon="doc" title="Servicios adheridos" subtitle="Agregá o quitá servicios" onPress={() => navigate('/servicios/')} />
        <ListItem icon="sync" title="Débito automático" subtitle="Pagá sin acordarte" onPress={() => navigate('/debito-automatico/')} />
        <ListItem icon="bell" title="Vencimientos" subtitle="Recordatorios antes de vencer" onPress={() => navigate('/vencimientos/')} />
        <ListItem icon="search" title="Historial de pagos" subtitle="Comprobantes de pagos anteriores" onPress={() => navigate('/historial/')} />
      </Card>
    </Screen>
  );
}
