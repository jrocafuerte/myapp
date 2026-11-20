'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { Receipt } from '../../../../shared/pagos-mfe/protocol';
import { Banner, Button, Card, Chips, Empty, Icon, KeyValue, SERVICE_ICON, Screen } from '../../components/ui';
import { useBridge, useTitle } from '../../lib/BridgeProvider';
import { date, money } from '../../lib/format';

function PagarServicio() {
  const id = useSearchParams().get('id');
  const { context, request, share, back, haptic } = useBridge();
  const [accountId, setAccountId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  useTitle(receipt ? 'Comprobante' : 'Confirmar pago');
  if (!context) return null;
  const srv = context.services.find((s) => s.id === id);
  const accounts = context.accounts.filter((a) => a.currency === 'USD');
  const selected = accountId ?? accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id;

  if (receipt) {
    const text = `COMPROBANTE BANCO PLUS\n${receipt.description}\nMonto: ${money(receipt.amount, receipt.currency)}\nFecha: ${date(receipt.date, true)}\nCuenta: ${receipt.accountAlias}\nReferencia: ${receipt.reference}`;
    return (
      <Screen title="Comprobante">
        <Card label="Pago realizado">
          <div className="check"><Icon name="check" size={32} /></div>
          <p className="t-heading center" role="status">Pago realizado</p>
          <span className="t-title center num">{money(receipt.amount, receipt.currency)}</span>
          <KeyValue k="Servicio" v={receipt.description.replace(/^Pago /, '')} />
          <KeyValue k="Fecha" v={date(receipt.date, true)} />
          <KeyValue k="Cuenta" v={receipt.accountAlias} />
          <KeyValue k="Referencia" v={receipt.reference} />
        </Card>
        <Button title="Compartir comprobante" icon="share" variant="secondary" onPress={() => share(text)} />
        <Button title="Listo" onPress={back} />
      </Screen>
    );
  }

  if (!srv) return <Screen title="Confirmar pago"><Empty text="No encontramos esta factura." /></Screen>;
  const pay = async () => {
    if (!selected) return;
    setBusy(true); setError(null);
    const r = await request({ name: 'payService', serviceId: srv.id, accountId: selected });
    setBusy(false);
    if (r.ok) setReceipt(r.receipt ?? null); else { setError(r.error); haptic('error'); }
  };
  return (
    <Screen title="Confirmar pago">
      <Card label="Factura">
        <div className="inline"><span className="item__icon"><Icon name={SERVICE_ICON[srv.type]} /></span><h2 className="t-heading">{srv.company}</h2></div>
        <span className="t-title num">{money(srv.amountDue)}</span>
        <KeyValue k="Servicio" v={srv.type} />
        <KeyValue k="Número de cliente" v={srv.customerNumber} />
        <KeyValue k="Vencimiento" v={date(srv.dueDate)} />
      </Card>
      {srv.amountDue === 0 ? <Banner kind="success" text="Esta factura ya está pagada." /> : (
        <Card label="Medio de pago">
          <Chips label="Pagar con" value={selected} onChange={setAccountId}
            options={accounts.map((a) => ({ label: `${a.alias} · ${money(a.balance, a.currency, { hidden: context.hideBalances })}`, value: a.id }))} />
        </Card>
      )}
      <Banner kind="error" text={error} />
      {srv.amountDue > 0 ? <Button title={`Pagar ${money(srv.amountDue)}`} onPress={pay} loading={busy} disabled={!selected} /> : null}
    </Screen>
  );
}

export default function Page() {
  // useSearchParams en exportación estática requiere un límite de Suspense.
  return <Suspense fallback={null}><PagarServicio /></Suspense>;
}
