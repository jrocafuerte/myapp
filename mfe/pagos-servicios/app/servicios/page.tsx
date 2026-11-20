'use client';
import { useState } from 'react';
import { SERVICE_TYPES, type ServiceType } from '../../../../shared/pagos-mfe/protocol';
import { Banner, Button, Card, Chips, ConfirmButton, Empty, Field, ListItem, SERVICE_ICON, Screen } from '../../components/ui';
import { useBridge, useTitle } from '../../lib/BridgeProvider';
import { money } from '../../lib/format';
import { useOperation } from '../../lib/useOperation';

export default function Servicios() {
  useTitle('Servicios adheridos');
  const { context } = useBridge();
  const { run, error, success, busy } = useOperation();
  const [type, setType] = useState<ServiceType>('Luz');
  const [company, setCompany] = useState('');
  const [customer, setCustomer] = useState('');
  if (!context) return null;
  const add = async () => { if (await run({ name: 'addService', company, type, customerNumber: customer }, 'Servicio adherido.')) { setCompany(''); setCustomer(''); } };
  return (
    <Screen title="Servicios adheridos">
      <Card label="Adherir servicio">
        <h2 className="t-heading">Adherir servicio</h2>
        <Chips label="Rubro" value={type} onChange={setType} options={SERVICE_TYPES.filter((t) => t !== 'Impuestos').map((t) => ({ label: t, value: t }))} />
        <Field id="empresa" label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
        <Field id="cliente" label="Número de cliente" hint="Figura en tu factura (4 a 20 caracteres)." value={customer}
          onChange={(e) => setCustomer(e.target.value)} autoCapitalize="characters" autoComplete="off" enterKeyHint="done" />
        <Button title="Adherir" onPress={add} loading={busy} disabled={!company.trim() || !customer.trim()} />
      </Card>
      <Banner kind="error" text={error} />
      <Banner kind="success" text={success} />
      <Card label="Mis servicios">
        <h2 className="t-heading">Mis servicios</h2>
        {context.services.length === 0 ? <Empty text="Todavía no adheriste servicios." /> : context.services.map((s) => (
          <div key={s.id} className="stack-sm">
            <ListItem icon={SERVICE_ICON[s.type]} title={`${s.company} · ${s.type}`} subtitle={`Cliente ${s.customerNumber}${s.autoDebit ? ' · débito automático' : ''}`}
              right={s.amountDue ? money(s.amountDue) : 'Al día'} rightClass={s.amountDue ? undefined : 'success'} />
            <ConfirmButton small title="Quitar" onConfirm={() => run({ name: 'removeService', serviceId: s.id }, `${s.company} eliminado.`)} />
          </div>
        ))}
      </Card>
    </Screen>
  );
}
