import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Share } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import type { Currency, Service } from '../../store/types';
import {
  AccountPicker, Banner, Button, Card, Chips, ConfirmButton, EmptyState, Inline, Input, KeyValue, ListItem, palette, Screen, Stack, Surface, Text, ToggleRow, useAction,
} from '../../ui/kit';
import { date, isoDay, money, parseAmount } from '../../utils/format';
import { PagosServiciosMFE } from '../mfe/PagosServiciosMFE';
import { useMessage } from '../../remote-config/RemoteConfigProvider';
import type { Feature } from '../types';

const usePrimary = () => { const { state } = useBank(); return state.accounts.find((a) => a.isPrimary && !a.closed)?.id; };

function BeneficiaryPicker({ value, onChange, favoritesOnly }: { value?: string; onChange: (id: string) => void; favoritesOnly?: boolean }) {
  const { state } = useBank();
  const list = [...state.beneficiaries].filter((b) => !favoritesOnly || b.favorite).sort((a, b) => Number(b.favorite) - Number(a.favorite));
  return <Chips label="Destinatario" options={list.map((b) => ({ label: `${b.favorite ? '★ ' : ''}${b.name}`, value: b.id }))} value={value} onChange={onChange} />;
}

/** Componente de confirmación con token cuando 2FA está activo y el monto es alto. */
function useTwoFactor(amount: number) {
  const { state } = useBank();
  const [code, setCode] = useState('');
  const message = useMessage();
  const needed = state.settings.twoFactor && amount >= 1000;
  const field = needed ? <Input label="Token digital (requerido para montos ≥ 1,000)" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} hint="Lo encontrás en Seguridad → Token digital" /> : null;
  const check = () => (needed && code !== L.otpCode(state.user.username) ? message('token_digital_incorrecto_vencido') : null);
  return { field, check, reset: () => setCode('') };
}

function TransferOwn() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(usePrimary()); const [to, setTo] = useState<string>(); const [amount, setAmount] = useState(''); const [concept, setConcept] = useState('');
  const fa = state.accounts.find((a) => a.id === from); const ta = state.accounts.find((a) => a.id === to);
  const n = parseAmount(amount);
  return (
    <Screen><Card>
      <Text variant="heading">Entre mis cuentas</Text>
      <AccountPicker label="Desde" value={from} onChange={setFrom} />
      <AccountPicker label="Hacia" value={to} onChange={setTo} exclude={from} />
      <Input label={`Monto${fa ? ` (${fa.currency})` : ''}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {fa && ta && fa.currency !== ta.currency && n > 0 ? <Banner kind="info" text={`Recibirás ≈ ${money(n * L.fxQuote(fa.currency, ta.currency).rate, ta.currency)} (tipo de cambio con spread 1.5%).`} /> : null}
      <Input label="Concepto (opcional)" value={concept} onChangeText={setConcept} />
      {feedback}
      <Button title="Transferir" icon="swap-horizontal" disabled={!from || !to} onPress={() => { if (exec((s) => L.transferOwn(s, from!, to!, n, concept), 'Transferencia realizada.')) setAmount(''); }} />
    </Card></Screen>
  );
}

function TransferThird({ favoritesOnly }: { favoritesOnly?: boolean }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(usePrimary()); const [ben, setBen] = useState<string>(); const [amount, setAmount] = useState(''); const [concept, setConcept] = useState('');
  const n = parseAmount(amount);
  const tf = useTwoFactor(n);
  const remaining = state.settings.dailyTransferLimit - (state.transferredToday.date === isoDay() ? state.transferredToday.amount : 0);
  return (
    <Screen><Card>
      <Text variant="heading">{favoritesOnly ? 'Transferir a favoritos' : 'Transferir a terceros'}</Text>
      <AccountPicker label="Desde" value={from} onChange={setFrom} />
      <BeneficiaryPicker value={ben} onChange={setBen} favoritesOnly={favoritesOnly} />
      {favoritesOnly && !state.beneficiaries.some((b) => b.favorite) ? <EmptyState text="No tenés favoritos. Marcalos desde la agenda." /> : null}
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint={`Disponible hoy según tu límite: ${money(remaining)}`} />
      <Input label="Concepto" value={concept} onChangeText={setConcept} placeholder="Ej: Varios" />
      {tf.field}
      {feedback}
      <Button title="Transferir" icon="paper-plane-outline" disabled={!from || !ben} onPress={() => { if (exec((s) => L.transferToBeneficiary(s, from!, ben!, n, concept), 'Transferencia enviada.', tf.check)) { setAmount(''); tf.reset(); } }} />
    </Card></Screen>
  );
}

function TransferAlias() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(usePrimary()); const [key, setKey] = useState(''); const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [save, setSave] = useState(true);
  const found = key.length >= 6 ? L.findByAliasOrNumber(state, key) : undefined;
  const n = parseAmount(amount); const tf = useTwoFactor(n);
  return (
    <Screen><Card>
      <Text variant="heading">Transferir por alias o número de cuenta</Text>
      <AccountPicker label="Desde" value={from} onChange={setFrom} />
      <Input label="Alias o número de cuenta" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="ej: carlos.mendez o 0045-1122-3344" />
      {found ? <Banner kind="success" text={`Titular: ${found.name} · ${found.bank}`} /> : key.length >= 6 ? <Input label="Nombre del titular" value={name} onChangeText={setName} /> : null}
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {!found ? <ToggleRow title="Guardar en mi agenda" value={save} onChange={setSave} /> : null}
      {tf.field}
      {feedback}
      <Button title="Transferir" disabled={!from} onPress={() => { if (exec((s) => L.transferByAlias(s, from!, key, name, n, '', save), 'Transferencia enviada.', tf.check)) { setAmount(''); tf.reset(); } }} />
    </Card></Screen>
  );
}

function Beneficiaries({ mode }: { mode: 'list' | 'remove' | 'favorites' }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const list = mode === 'favorites' ? [...state.beneficiaries].sort((a, b) => Number(b.favorite) - Number(a.favorite)) : state.beneficiaries;
  return (
    <Screen>
      {feedback}
      {list.length === 0 ? <EmptyState text="Tu agenda está vacía" /> : list.map((b) => (
        <Card key={b.id}>
          <ListItem icon={b.favorite ? 'star' : 'person-outline'} title={b.name} subtitle={`${b.bank} · ${b.alias || b.accountNumber}`} />
          <Inline gap="sm">
            <Button small title={b.favorite ? 'Quitar favorito' : 'Favorito'} icon={b.favorite ? 'star' : 'star-outline'} variant="secondary" onPress={() => exec((s) => L.toggleFavorite(s, b.id), 'Agenda actualizada.')} />
            {mode !== 'favorites' ? <ConfirmButton small title="Eliminar" variant="ghost" onConfirm={() => exec((s) => L.removeBeneficiary(s, b.id), `${b.name} eliminado.`)} /> : null}
          </Inline>
        </Card>
      ))}
    </Screen>
  );
}

function AddBeneficiary() {
  const { exec, feedback } = useAction();
  const [f, setF] = useState({ name: '', bank: '', accountNumber: '', alias: '', currency: 'USD' as Currency });
  return (
    <Screen><Card>
      <Text variant="heading">Nuevo destinatario</Text>
      <Input label="Nombre y apellido" value={f.name} onChangeText={(name) => setF({ ...f, name })} />
      <Input label="Banco" value={f.bank} onChangeText={(bank) => setF({ ...f, bank })} />
      <Input label="Número de cuenta" value={f.accountNumber} onChangeText={(accountNumber) => setF({ ...f, accountNumber })} keyboardType="numbers-and-punctuation" />
      <Input label="Alias (opcional)" value={f.alias} onChangeText={(alias) => setF({ ...f, alias })} autoCapitalize="none" />
      <Chips label="Moneda" options={(['USD', 'EUR', 'GBP'] as Currency[]).map((c) => ({ label: c, value: c }))} value={f.currency} onChange={(currency) => setF({ ...f, currency })} />
      {feedback}
      <Button title="Agregar" onPress={() => { if (exec((s) => L.addBeneficiary(s, f), 'Destinatario agregado.')) setF({ name: '', bank: '', accountNumber: '', alias: '', currency: 'USD' }); }} />
    </Card></Screen>
  );
}

function ScheduleTransfer({ recurring }: { recurring?: boolean }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(usePrimary()); const [ben, setBen] = useState<string>(); const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(isoDay(1)); const [freq, setFreq] = useState<'unica' | 'semanal' | 'mensual'>(recurring ? 'mensual' : 'unica'); const [concept, setConcept] = useState('');
  const list = state.scheduled.filter((x) => x.active);
  return (
    <Screen>
      <Card>
        <Text variant="heading">{recurring ? 'Transferencia recurrente' : 'Programar transferencia'}</Text>
        <AccountPicker label="Desde" value={from} onChange={setFrom} />
        <BeneficiaryPicker value={ben} onChange={setBen} />
        <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Input label="Fecha (AAAA-MM-DD)" value={when} onChangeText={setWhen} />
        <Chips label="Frecuencia" options={[...(recurring ? [] : [{ label: 'Única vez', value: 'unica' as const }]), { label: 'Semanal', value: 'semanal' as const }, { label: 'Mensual', value: 'mensual' as const }]} value={freq} onChange={setFreq} />
        <Input label="Concepto" value={concept} onChangeText={setConcept} />
        {feedback}
        <Button title="Programar" icon="calendar-outline" disabled={!from || !ben} onPress={() => { if (exec((s) => L.scheduleTransfer(s, { fromId: from!, beneficiaryId: ben!, amount: parseAmount(amount), date: when, frequency: freq, concept }), 'Transferencia programada.')) setAmount(''); }} />
      </Card>
      <ScheduledList />
      {list.length === 0 ? null : <Text variant="caption" tone="muted">Las programadas se ejecutan automáticamente al abrir la app en la fecha indicada.</Text>}
    </Screen>
  );
}

function ScheduledList() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const list = state.scheduled.filter((x) => x.active);
  return (
    <Card>
      <Text variant="heading">Programadas activas</Text>
      {feedback}
      {list.length === 0 ? <EmptyState text="No tenés transferencias programadas" /> : list.map((x) => {
        const b = state.beneficiaries.find((y) => y.id === x.beneficiaryId);
        return (
          <Stack key={x.id} gap="sm">
            <ListItem icon="repeat-outline" title={`${b?.name ?? '—'} · ${x.concept}`} subtitle={`${x.frequency} · próxima ${date(x.nextDate)}`} right={money(x.amount)} />
            <ConfirmButton small title="Cancelar" variant="ghost" onConfirm={() => exec((s) => L.cancelScheduled(s, x.id), 'Transferencia cancelada.')} />
          </Stack>
        );
      })}
    </Card>
  );
}

function TransferLimits() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [per, setPer] = useState(String(state.settings.perTransferLimit)); const [daily, setDaily] = useState(String(state.settings.dailyTransferLimit));
  const used = state.transferredToday.date === isoDay() ? state.transferredToday.amount : 0;
  const tf = useTwoFactor(10000);
  return (
    <Screen><Card>
      <Text variant="heading">Límites de transferencia</Text>
      <KeyValue k="Usado hoy" v={money(used)} />
      <Input label="Límite por operación (USD)" value={per} onChangeText={setPer} keyboardType="decimal-pad" />
      <Input label="Límite diario (USD, máx. 50,000)" value={daily} onChangeText={setDaily} keyboardType="decimal-pad" />
      {tf.field}
      {feedback}
      <Button title="Guardar límites" onPress={() => exec((s) => L.setTransferLimits(s, parseAmount(per), parseAmount(daily)), 'Límites actualizados.', tf.check)} />
    </Card></Screen>
  );
}

function International() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(usePrimary());
  const [f, setF] = useState({ name: '', iban: '', swift: '', country: '', currency: 'EUR' as Currency, amount: '', concept: '' });
  const fa = state.accounts.find((a) => a.id === from);
  const n = parseAmount(f.amount);
  const cost = fa && n > 0 ? n / L.fxQuote(fa.currency, f.currency).rate : 0;
  const tf = useTwoFactor(1000);
  return (
    <Screen><Card>
      <Text variant="heading">Transferencia internacional (SWIFT)</Text>
      <AccountPicker label="Desde" value={from} onChange={setFrom} />
      <Input label="Beneficiario" value={f.name} onChangeText={(name) => setF({ ...f, name })} />
      <Input label="IBAN" value={f.iban} onChangeText={(iban) => setF({ ...f, iban })} autoCapitalize="characters" placeholder="ES9121000418450200051332" />
      <Input label="SWIFT / BIC" value={f.swift} onChangeText={(swift) => setF({ ...f, swift })} autoCapitalize="characters" placeholder="CAIXESBBXXX" />
      <Input label="País" value={f.country} onChangeText={(country) => setF({ ...f, country })} />
      <Chips label="Moneda a enviar" options={(['USD', 'EUR', 'GBP'] as Currency[]).map((c) => ({ label: c, value: c }))} value={f.currency} onChange={(currency) => setF({ ...f, currency })} />
      <Input label={`Monto en ${f.currency}`} value={f.amount} onChangeText={(amount) => setF({ ...f, amount })} keyboardType="decimal-pad" />
      <Input label="Motivo" value={f.concept} onChangeText={(concept) => setF({ ...f, concept })} />
      {fa && cost > 0 ? <Banner kind="info" text={`Debitaremos ${money(cost, fa.currency)} + comisión ${money(L.convert(L.INTL_FEE_USD, 'USD', fa.currency), fa.currency)}. Llega en 1-3 días hábiles.`} /> : null}
      {tf.field}
      {feedback}
      <Button title="Enviar" icon="earth-outline" disabled={!from} onPress={() => exec((s) => L.transferInternational(s, from!, { ...f, swift: f.swift.toUpperCase(), iban: f.iban.toUpperCase(), amount: n }), 'Transferencia internacional enviada.', tf.check)} />
    </Card></Screen>
  );
}

/** QR simple derivado del texto (visual; para producción usar una librería QR estándar). */
export function PseudoQR({ value, size = 200 }: { value: string; size?: number }) {
  const n = 25; const cell = size / n;
  let h = 0; for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rects: React.ReactNode[] = [];
  const finder = (x: number, y: number) => (i: number, j: number) => i >= x && i < x + 7 && j >= y && j < y + 7 && (i === x || i === x + 6 || j === y || j === y + 6 || (i >= x + 2 && i <= x + 4 && j >= y + 2 && j <= y + 4));
  const fs = [finder(0, 0), finder(n - 7, 0), finder(0, n - 7)];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const inFinder = (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
    h = (h * 1103515245 + 12345) >>> 0;
    const on = inFinder ? fs.some((f) => f(i, j)) : (h >> 16) % 2 === 0;
    if (on) rects.push(<Rect key={`${i}-${j}`} x={i * cell} y={j * cell} width={cell} height={cell} fill={palette.black} />);
  }
  // Un QR siempre se dibuja negro sobre blanco (también en modo oscuro) para que los lectores lo reconozcan.
  return <Surface background="inverse" padding="md" radius="md" alignSelf="center" bordered><Svg width={size} height={size}>{rects}</Svg></Surface>;
}

function ReceiveQr() {
  const { state } = useBank();
  const [acc, setAcc] = useState(usePrimary()); const [amount, setAmount] = useState('');
  const payload = acc ? L.qrPayload(state, acc, parseAmount(amount) || undefined) : '';
  return (
    <Screen>
      <AccountPicker label="Cobrar en" value={acc} onChange={setAcc} />
      <Input label="Monto (opcional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Card align="center">
        <PseudoQR value={payload} />
        <Text variant="micro" tone="muted" selectable align="center">{payload}</Text>
      </Card>
      <Button title="Compartir link de cobro" icon="share-outline" onPress={() => Share.share({ message: payload }).catch(() => {})} />
      <Button title="Copiar" variant="secondary" onPress={() => Clipboard.setStringAsync(payload)} />
    </Screen>
  );
}

function RequestMoney() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [who, setWho] = useState(''); const [amount, setAmount] = useState(''); const [concept, setConcept] = useState('');
  const [payFrom, setPayFrom] = useState(usePrimary());
  const incoming = state.requests.filter((r) => r.direction === 'recibida' && r.status === 'pendiente');
  return (
    <Screen>
      <Card>
        <Text variant="heading">Pedir dinero</Text>
        <Input label="A quién" value={who} onChangeText={setWho} placeholder="Nombre o alias" />
        <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Input label="Concepto" value={concept} onChangeText={setConcept} />
        <Button title="Enviar solicitud" onPress={() => { if (exec((s) => L.requestMoney(s, who, parseAmount(amount), concept), 'Solicitud enviada.')) { setWho(''); setAmount(''); } }} />
      </Card>
      {feedback}
      <Card>
        <Text variant="heading">Solicitudes recibidas</Text>
        {incoming.length === 0 ? <EmptyState text="No tenés solicitudes pendientes" /> : (
          <>
            <AccountPicker label="Pagar desde" value={payFrom} onChange={setPayFrom} />
            {incoming.map((r) => (
              <Stack key={r.id} gap="sm">
                <ListItem icon="hand-left-outline" title={`${r.counterpart} · ${r.concept}`} subtitle={date(r.date)} right={money(r.amount)} />
                <Inline gap="sm">
                  <Button small title="Pagar" onPress={() => exec((s) => L.answerRequest(s, r.id, true, payFrom!), 'Solicitud pagada.')} />
                  <Button small title="Rechazar" variant="ghost" onPress={() => exec((s) => L.answerRequest(s, r.id, false, payFrom!), 'Solicitud rechazada.')} />
                </Inline>
              </Stack>
            ))}
          </>
        )}
      </Card>
      <Card>
        <Text variant="heading">Enviadas</Text>
        {state.requests.filter((r) => r.direction === 'enviada').slice(0, 10).map((r) => <ListItem key={r.id} icon="send-outline" title={`${r.counterpart} · ${r.concept}`} subtitle={`${date(r.date)} · ${r.status}`} right={money(r.amount)} />)}
      </Card>
    </Screen>
  );
}

function SplitBillScreen() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [concept, setConcept] = useState(''); const [total, setTotal] = useState(''); const [names, setNames] = useState(''); const [me, setMe] = useState(true);
  const [acc, setAcc] = useState(usePrimary());
  const people = names.split(',').map((x) => x.trim()).filter(Boolean);
  const share = parseAmount(total) / Math.max(1, people.length + (me ? 1 : 0));
  return (
    <Screen>
      <Card>
        <Text variant="heading">Dividir un gasto</Text>
        <Input label="Concepto" value={concept} onChangeText={setConcept} placeholder="Cena, viaje…" />
        <Input label="Total" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
        <Input label="Personas (separadas por coma)" value={names} onChangeText={setNames} placeholder="Juan, Sofía, Pedro" />
        <ToggleRow title="Incluirme en la división" value={me} onChange={setMe} />
        {people.length && share > 0 ? <Text>Cada uno paga <Text weight="bold">{money(share)}</Text></Text> : null}
        <Button title="Crear y enviar solicitudes" onPress={() => { if (exec((s) => L.createSplit(s, concept, parseAmount(total), people, me), 'Gasto dividido y solicitudes enviadas.')) { setTotal(''); setNames(''); } }} />
      </Card>
      {feedback}
      {state.splits.length ? <AccountPicker label="Acreditar pagos en" value={acc} onChange={setAcc} /> : null}
      {state.splits.map((sp) => (
        <Card key={sp.id}>
          <Text variant="heading">{sp.concept} · {money(sp.total)}</Text>
          {sp.participants.map((p) => (
            <Inline key={p.name} align="center" justify="between">
              <Text>{p.paid ? '✅' : '⏳'} {p.name} · {money(p.share)}</Text>
              {!p.paid ? <Button small title="Marcar pagado" variant="secondary" onPress={() => exec((s) => L.markSplitPaid(s, sp.id, p.name, acc!), `${p.name} pagó.`)} /> : null}
            </Inline>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

/* --------------------------------- Pagos --------------------------------- */
function MobileTopUp() {
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [op, setOp] = useState(L.TOPUP_OPERATORS[0]); const [phone, setPhone] = useState(''); const [amount, setAmount] = useState(10);
  return (
    <Screen><Card>
      <Text variant="heading">Recarga de celular</Text>
      <AccountPicker value={acc} onChange={setAcc} />
      <Chips label="Operadora" options={L.TOPUP_OPERATORS.map((o) => ({ label: o, value: o }))} value={op} onChange={setOp} />
      <Input label="Número" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Chips label="Monto" options={[5, 10, 20, 30, 50].map((v) => ({ label: money(v), value: v }))} value={amount} onChange={setAmount} />
      {feedback}
      <Button title="Recargar" icon="phone-portrait-outline" onPress={() => exec((s) => L.mobileTopUp(s, acc!, op, phone, amount), 'Recarga realizada.')} />
    </Card></Screen>
  );
}

function PayTaxes() {
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [tax, setTax] = useState<string>(L.TAXES[0]); const [taxId, setTaxId] = useState(''); const [amount, setAmount] = useState('');
  return (
    <Screen><Card>
      <Text variant="heading">Pago de impuestos</Text>
      <AccountPicker value={acc} onChange={setAcc} />
      <Chips label="Impuesto" options={L.TAXES.map((t) => ({ label: t, value: t as string }))} value={tax} onChange={setTax} />
      <Input label="Identificador (partida, patente, RUC…)" value={taxId} onChangeText={setTaxId} autoCapitalize="characters" />
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {feedback}
      <Button title="Pagar impuesto" onPress={() => { if (exec((s) => L.payTax(s, acc!, tax, taxId, parseAmount(amount)), 'Impuesto pagado.')) setAmount(''); }} />
    </Card></Screen>
  );
}

function PayQr() {
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [code, setCode] = useState(''); const [amount, setAmount] = useState('');
  const pre = /amount=([\d.]+)/.exec(code)?.[1];
  return (
    <Screen><Card>
      <Text variant="heading">Pagar con QR</Text>
      <Text tone="muted" variant="bodySmall">Escaneá el QR del comercio o pegá el código. (Probá con COMERCIO-CAFE01.)</Text>
      <AccountPicker value={acc} onChange={setAcc} />
      <Input label="Código QR" value={code} onChangeText={setCode} autoCapitalize="characters" />
      <Input label="Monto" value={pre ?? amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!pre} />
      {feedback}
      <Button title="Pagar" icon="qr-code-outline" onPress={() => { if (exec((s) => L.payQr(s, acc!, code, parseAmount(pre ?? amount)), 'Pago realizado. ¡Sumaste puntos!')) { setCode(''); setAmount(''); } }} />
    </Card></Screen>
  );
}

function TransportTopUp() {
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [card, setCard] = useState(''); const [amount, setAmount] = useState('10');
  return (
    <Screen><Card>
      <Text variant="heading">Recarga de transporte</Text>
      <AccountPicker value={acc} onChange={setAcc} />
      <Input label="Número de tarjeta de transporte" value={card} onChangeText={setCard} keyboardType="number-pad" />
      <Input label="Monto (2-100)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {feedback}
      <Button title="Recargar" icon="bus-outline" onPress={() => exec((s) => L.transportTopUp(s, acc!, card, parseAmount(amount)), 'Recarga acreditada.')} />
    </Card></Screen>
  );
}

function PayCreditCard() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const credit = state.cards.filter((c) => c.kind === 'credito' && c.status !== 'cancelada');
  const [cardId, setCardId] = useState(credit[0]?.id); const [acc, setAcc] = useState(usePrimary()); const [amount, setAmount] = useState('');
  const card = credit.find((c) => c.id === cardId);
  if (!card) return <Screen><EmptyState text="No tenés tarjetas de crédito" /></Screen>;
  const st = L.creditCardStatement(card);
  return (
    <Screen><Card>
      <Text variant="heading">Pagar tarjeta de crédito</Text>
      <Chips options={credit.map((c) => ({ label: `${c.brand} ••${c.number.slice(-4)}`, value: c.id }))} value={cardId} onChange={setCardId} />
      <KeyValue k="Saldo actual" v={money(st.balance)} /><KeyValue k="Pago mínimo" v={money(st.minimum)} /><KeyValue k="Vencimiento" v={date(st.dueDate)} />
      <AccountPicker label="Pagar desde" value={acc} onChange={setAcc} />
      <Inline gap="sm">
        <Button small title="Mínimo" variant="secondary" onPress={() => setAmount(String(Math.min(st.minimum, st.balance)))} />
        <Button small title="Total" variant="secondary" onPress={() => setAmount(String(st.balance))} />
      </Inline>
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {feedback}
      <Button title="Pagar" onPress={() => { if (exec((s) => L.payCreditCard(s, card.id, acc!, parseAmount(amount)), 'Pago de tarjeta realizado.')) setAmount(''); }} />
    </Card></Screen>
  );
}

export const transferFeatures: Feature[] = [
  { id: 'transfer-own', module: 'transferencias', title: 'Entre mis cuentas', description: 'Inmediata, con conversión de moneda', icon: 'swap-horizontal-outline', Component: TransferOwn },
  { id: 'transfer-third', module: 'transferencias', title: 'A terceros', description: 'A tu agenda de destinatarios', icon: 'paper-plane-outline', Component: () => <TransferThird /> },
  { id: 'transfer-alias', module: 'transferencias', title: 'Por alias o número', description: 'A cualquier cuenta', icon: 'at-outline', Component: TransferAlias },
  { id: 'beneficiaries', module: 'transferencias', title: 'Agenda de destinatarios', description: 'Tus contactos frecuentes', icon: 'people-outline', Component: () => <Beneficiaries mode="list" /> },
  { id: 'add-beneficiary', module: 'transferencias', title: 'Agregar destinatario', description: 'Con validación de cuenta', icon: 'person-add-outline', Component: AddBeneficiary },
  { id: 'remove-beneficiary', module: 'transferencias', title: 'Eliminar destinatario', description: 'Mantené tu agenda limpia', icon: 'person-remove-outline', Component: () => <Beneficiaries mode="remove" /> },
  { id: 'favorite-beneficiaries', module: 'transferencias', title: 'Favoritos', description: 'Transferí en dos toques', icon: 'star-outline', Component: () => <TransferThird favoritesOnly /> },
  { id: 'scheduled-transfer', module: 'transferencias', title: 'Transferencias programadas', description: 'Elegí la fecha de envío', icon: 'calendar-outline', Component: () => <ScheduleTransfer /> },
  { id: 'recurring-transfer', module: 'transferencias', title: 'Transferencias recurrentes', description: 'Semanales o mensuales', icon: 'repeat-outline', Component: () => <ScheduleTransfer recurring /> },
  { id: 'transfer-limits', module: 'transferencias', title: 'Límites de transferencia', description: 'Por operación y diario', icon: 'speedometer-outline', Component: TransferLimits },
  { id: 'international-transfer', module: 'transferencias', title: 'Transferencia internacional', description: 'SWIFT con IBAN', icon: 'earth-outline', Component: International },
  { id: 'receive-qr', module: 'transferencias', title: 'Cobrar con QR', description: 'Generá tu código de cobro', icon: 'qr-code-outline', Component: ReceiveQr },
  { id: 'request-money', module: 'transferencias', title: 'Pedir dinero', description: 'Enviá y respondé solicitudes', icon: 'hand-left-outline', Component: RequestMoney },
  { id: 'split-bill', module: 'transferencias', title: 'Dividir gastos', description: 'Repartí una cuenta entre amigos', icon: 'git-branch-outline', Component: SplitBillScreen },

  { id: 'pay-services', module: 'pagos', title: 'Pago de servicios', description: 'Luz, agua, gas, internet', icon: 'flash-outline', Component: () => <PagosServiciosMFE route="pagar" fallbackTitle="Pago de servicios" /> },
  { id: 'adhered-services', module: 'pagos', title: 'Servicios adheridos', description: 'Agregá o quitá servicios', icon: 'business-outline', Component: () => <PagosServiciosMFE route="servicios" fallbackTitle="Servicios adheridos" /> },
  { id: 'mobile-topup', module: 'pagos', title: 'Recarga de celular', description: 'Todas las operadoras', icon: 'phone-portrait-outline', Component: MobileTopUp },
  { id: 'pay-taxes', module: 'pagos', title: 'Pago de impuestos', description: 'Predial, vehicular, renta', icon: 'library-outline', Component: PayTaxes },
  { id: 'auto-debit', module: 'pagos', title: 'Débito automático', description: 'Pagá sin acordarte', icon: 'sync-outline', Component: () => <PagosServiciosMFE route="debitoAutomatico" fallbackTitle="Débito automático" /> },
  { id: 'due-reminders', module: 'pagos', title: 'Recordatorios de vencimiento', description: 'Alertas antes de vencer', icon: 'alarm-outline', Component: () => <PagosServiciosMFE route="vencimientos" fallbackTitle="Vencimientos" /> },
  { id: 'payment-history', module: 'pagos', title: 'Historial de pagos', description: 'Todos tus pagos realizados', icon: 'time-outline', Component: () => <PagosServiciosMFE route="historial" fallbackTitle="Historial de pagos" /> },
  { id: 'pay-qr', module: 'pagos', title: 'Pagar con QR', description: 'En comercios adheridos', icon: 'scan-outline', Component: PayQr },
  { id: 'transport-topup', module: 'pagos', title: 'Recarga de transporte', description: 'Tarjeta de transporte público', icon: 'bus-outline', Component: TransportTopUp },
  { id: 'pay-credit-card', module: 'pagos', title: 'Pagar tarjeta de crédito', description: 'Mínimo, total u otro monto', icon: 'card-outline', Component: PayCreditCard },
];
