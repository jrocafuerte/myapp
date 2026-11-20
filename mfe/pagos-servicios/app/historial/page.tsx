'use client';
import { useState } from 'react';
import { Card, Empty, Field, ListItem, Screen } from '../../components/ui';
import { useBridge, useTitle } from '../../lib/BridgeProvider';
import { date, money } from '../../lib/format';

export default function Historial() {
  useTitle('Historial de pagos');
  const { context, share } = useBridge();
  const [q, setQ] = useState('');
  if (!context) return null;
  const query = q.trim().toLowerCase();
  const list = context.payments.filter((p) => !query || `${p.description} ${p.reference}`.toLowerCase().includes(query));
  return (
    <Screen title="Historial de pagos">
      <Field id="buscar" label="Buscar" placeholder="Empresa o referencia" value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="search" />
      <Card label="Pagos">
        {list.length === 0 ? <Empty icon="search" text={query ? 'No hay pagos que coincidan.' : 'Todavía no hiciste pagos.'} /> : list.map((p) => (
          <ListItem key={p.id} icon="doc" title={p.description} subtitle={`${date(p.date)} · ${p.accountAlias} · ${p.reference}`}
            right={money(p.amount, p.currency, { hidden: context.hideBalances })}
            onPress={() => share(`COMPROBANTE BANCO PLUS\n${p.description}\nMonto: ${money(-p.amount, p.currency)}\nFecha: ${date(p.date, true)}\nCuenta: ${p.accountAlias}\nReferencia: ${p.reference}`)} />
        ))}
      </Card>
      <span className="t-caption muted center">Tocá un pago para compartir su comprobante.</span>
    </Screen>
  );
}
