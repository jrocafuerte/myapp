'use client';
import { Banner, Card, Empty, ListItem, SERVICE_ICON, Screen, Toggle } from '../../components/ui';
import { useBridge, useTitle } from '../../lib/BridgeProvider';
import { daysUntil, money } from '../../lib/format';
import { useOperation } from '../../lib/useOperation';

export default function Vencimientos() {
  useTitle('Vencimientos');
  const { context, navigate } = useBridge();
  const { run, error, busy } = useOperation();
  if (!context) return null;
  const pending = context.services.filter((s) => s.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <Screen title="Vencimientos">
      <Card label="Próximos vencimientos">
        <h2 className="t-heading">Próximos vencimientos</h2>
        {pending.length === 0 ? <Empty icon="check" text="No tenés vencimientos pendientes." /> : pending.map((s) => {
          const d = daysUntil(s.dueDate);
          return <ListItem key={s.id} icon={SERVICE_ICON[s.type]} title={s.company} right={money(s.amountDue)} rightClass={d <= 3 ? 'danger' : undefined}
            subtitle={d < 0 ? `Vencido hace ${-d} días` : d === 0 ? 'Vence hoy' : `Vence en ${d} ${d === 1 ? 'día' : 'días'}`}
            onPress={() => navigate(`/pagar/?id=${encodeURIComponent(s.id)}`)} />;
        })}
      </Card>
      <Banner kind="error" text={error} />
      <Card label="Recordatorios">
        <h2 className="t-heading">Recordatorios</h2>
        {context.services.map((s) => (
          <Toggle key={s.id} title={s.company} subtitle="Avisarme 3 días antes" value={s.reminder} disabled={busy}
            onChange={(on) => run({ name: 'setReminder', serviceId: s.id, on }, on ? 'Recordatorio activado.' : 'Recordatorio desactivado.')} />
        ))}
      </Card>
    </Screen>
  );
}
