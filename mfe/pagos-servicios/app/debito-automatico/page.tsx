'use client';
import { useState } from 'react';
import { Banner, Card, Chips, Empty, Screen, Toggle } from '../../components/ui';
import { useBridge, useTitle } from '../../lib/BridgeProvider';
import { money } from '../../lib/format';
import { useOperation } from '../../lib/useOperation';

export default function DebitoAutomatico() {
  useTitle('Débito automático');
  const { context } = useBridge();
  const { run, error, success, busy } = useOperation();
  const [accountId, setAccountId] = useState<string>();
  if (!context) return null;
  const selected = accountId ?? context.accounts.find((a) => a.isPrimary)?.id;
  const alias = (id?: string) => context.accounts.find((a) => a.id === id)?.alias ?? '—';
  return (
    <Screen title="Débito automático">
      <Card label="Cuenta">
        <Chips label="Cuenta para nuevos débitos" value={selected} onChange={setAccountId}
          options={context.accounts.map((a) => ({ label: `${a.alias} · ${money(a.balance, a.currency, { hidden: context.hideBalances })}`, value: a.id }))} />
        <span className="t-caption muted">Las facturas con débito automático se pagan solas el día del vencimiento.</span>
      </Card>
      <Banner kind="error" text={error} />
      <Banner kind="success" text={success} />
      <Card label="Servicios">
        {context.services.length === 0 ? <Empty text="Adherí un servicio para activar el débito automático." /> : context.services.map((s) => (
          <Toggle key={s.id} title={`${s.company} (${s.type})`} disabled={busy}
            subtitle={s.autoDebit ? `Se debita de ${alias(s.autoDebitAccountId)}` : 'Pago manual'} value={s.autoDebit}
            onChange={(on) => run({ name: 'setAutoDebit', serviceId: s.id, on, accountId: selected }, on ? 'Débito automático activado.' : 'Débito automático desactivado.')} />
        ))}
      </Card>
    </Screen>
  );
}
