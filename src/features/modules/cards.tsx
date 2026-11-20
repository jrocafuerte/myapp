import { router } from 'expo-router';
import React, { useState } from 'react';
import * as L from '../../store/logic';
import { cmd } from '../../store/commands';
import { useBank } from '../../store/BankContext';
import type { Card as BankCard } from '../../store/types';
import {
  AccountPicker, Banner, Button, Card, Chips, ConfirmButton, EmptyState, Inline, Input, KeyValue, Progress, Screen, Surface, Text, ToggleRow, useAction,
} from '../../ui/kit';
import { date, groupCard, isoDay, maskCard, money, parseAmount } from '../../utils/format';
import { useMessage } from '../../remote-config/RemoteConfigProvider';
import { gateway } from '../../api/gateway';
import type { Feature } from '../types';

export function CardVisual({ card, reveal, onPress }: { card: BankCard; reveal?: boolean; onPress?: () => void }) {
  const bg = card.status !== 'activa' ? 'cardInactive' : card.virtual ? 'cardVirtual' : card.kind === 'credito' ? 'cardCredit' : 'cardDebit';
  return (
    <Surface background={bg} radius="xl" padding="lg" gap="lg" aspectRatio={1.6} justify="between" elevation="md"
      onPress={onPress} accessibilityLabel={`Tarjeta ${card.brand} terminada en ${card.number.slice(-4)}`}>
      <Inline justify="between">
        <Text tone="inverse" weight="bold">{card.kind === 'credito' ? 'Crédito' : 'Débito'}{card.virtual ? ' · Virtual' : ''}{card.oneTime ? ' · 1 uso' : ''}</Text>
        <Text tone="inverse" weight="heavy">{card.brand.toUpperCase()}</Text>
      </Inline>
      <Text tone="inverse" variant="headline" weight="bold" letterSpacing="wide" selectable={reveal}>{reveal ? groupCard(card.number) : `•••• •••• •••• ${card.number.slice(-4)}`}</Text>
      <Inline justify="between">
        <Text tone="inverse" variant="bodySmall">{card.holder}</Text>
        <Text tone="inverse" variant="bodySmall">{card.expiry}{reveal ? `  CVV ${card.cvv}` : ''}</Text>
      </Inline>
      {card.status !== 'activa' ? <Text tone="highlight" weight="heavy" variant="caption">{card.status.toUpperCase()}</Text> : null}
    </Surface>
  );
}

const useCards = (filter?: (c: BankCard) => boolean) => {
  const { state } = useBank();
  return state.cards.filter((c) => c.status !== 'cancelada' && (!filter || filter(c)));
};

function CardPicker({ value, onChange, filter }: { value?: string; onChange: (id: string) => void; filter?: (c: BankCard) => boolean }) {
  const cards = useCards(filter);
  return <Chips label="Tarjeta" options={cards.map((c) => ({ label: `${c.kind === 'credito' ? 'Crédito' : 'Débito'} ${c.brand} ${maskCard(c.number)}${c.virtual ? ' (V)' : ''}`, value: c.id }))} value={value} onChange={onChange} />;
}

/** Hook: tarjeta seleccionada (por prop o elegida por el usuario). */
function useSelected(cardId?: string, filter?: (c: BankCard) => boolean) {
  const { state } = useBank();
  const cards = useCards(filter);
  const [id, setId] = useState(cardId ?? cards[0]?.id);
  const card = state.cards.find((c) => c.id === id);
  const picker = cardId ? null : <CardPicker value={id} onChange={setId} filter={filter} />;
  return { card, picker };
}

export function CardsList() {
  const cards = useCards();
  return (
    <Screen>
      {cards.length === 0 ? <EmptyState text="No tenés tarjetas activas" /> : cards.map((c) => <CardVisual key={c.id} card={c} onPress={() => router.push(`/tarjeta/${c.id}`)} />)}
      <Button title="Crear tarjeta virtual" icon="add" variant="secondary" onPress={() => router.push('/feature/virtual-card')} />
    </Screen>
  );
}

function LockCard({ cardId }: { cardId?: string }) {
  const { card, picker } = useSelected(cardId);
  const { exec, feedback } = useAction();
  if (!card) return <EmptyState text="Sin tarjetas" />;
  return (
    <Card>
      {picker}
      <ToggleRow title="Bloqueo temporal" subtitle={card.status === 'bloqueada' ? 'La tarjeta está bloqueada' : 'Bloqueala si no la encontrás'}
        value={card.status === 'bloqueada'} onChange={(v) => exec(cmd.setCardStatus(card.id, v ? 'bloqueada' : 'activa'), v ? 'Tarjeta bloqueada.' : 'Tarjeta desbloqueada.')} />
      {feedback}
    </Card>
  );
}

function ReportCard() {
  const { card, picker } = useSelected();
  const { exec, feedback } = useAction();
  const [reason, setReason] = useState<'robo' | 'pérdida' | 'daño'>('robo');
  const [reissue, setReissue] = useState(true);
  return (
    <Screen><Card>
      <Text variant="heading">Denunciar robo, pérdida o daño</Text>
      {picker}
      <Chips label="Motivo" options={[{ label: 'Robo', value: 'robo' }, { label: 'Pérdida', value: 'pérdida' }, { label: 'Daño', value: 'daño' }]} value={reason} onChange={setReason} />
      <ToggleRow title="Reponer tarjeta" subtitle="Nueva numeración, envío en 5 días hábiles" value={reissue} onChange={setReissue} />
      <Banner kind="info" text="La tarjeta denunciada se cancela de forma definitiva." />
      {feedback}
      {card ? <ConfirmButton title="Denunciar y cancelar" variant="danger" onConfirm={() => exec(cmd.reportCard(card.id, reason, reissue), 'Denuncia registrada.')} /> : null}
    </Card></Screen>
  );
}

function RevealCard({ cardId }: { cardId?: string }) {
  const { state, attempt } = useBank();
  const { card, picker } = useSelected(cardId);
  // Los datos completos se piden al gateway con el token: en modo BFF nunca están en el teléfono.
  const [secret, setSecret] = useState<{ number: string; cvv: string } | null>(null);
  const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const reveal = !!secret && secret.number.endsWith(card?.number.slice(-4) ?? '-');
  if (!card) return <EmptyState text="Sin tarjetas" />;
  return (
    <Card>
      {picker}
      <CardVisual card={reveal && secret ? { ...card, number: secret.number, cvv: secret.cvv } : card} reveal={reveal} />
      {!reveal ? (
        <>
          <Input label="Token digital para ver los datos" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Banner kind="error" text={err} />
          <Button title="Ver número y CVV" icon="eye-outline" loading={busy} onPress={async () => {
            setBusy(true);
            const r = await attempt(() => gateway.revealCard(state, card.id, code));
            setBusy(false); setErr(r.error);
            if (r.value) { setSecret(r.value); setCode(''); setTimeout(() => setSecret(null), 30000); }
          }} />
        </>
      ) : <Button title="Ocultar" variant="secondary" onPress={() => setSecret(null)} />}
    </Card>
  );
}

function VirtualCard({ oneTime }: { oneTime?: boolean }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(state.accounts.find((a) => a.isPrimary)?.id); const [limit, setLimit] = useState(oneTime ? '100' : '500');
  const virtual = state.cards.filter((c) => c.virtual && c.status !== 'cancelada' && c.oneTime === !!oneTime);
  return (
    <Screen>
      <Card>
        <Text variant="heading">{oneTime ? 'Tarjeta de un solo uso' : 'Nueva tarjeta virtual'}</Text>
        <Text tone="muted" variant="bodySmall">{oneTime ? 'Se cancela automáticamente después de la primera compra. Ideal para sitios desconocidos.' : 'Para compras online y suscripciones. Lista para usar al instante.'}</Text>
        <AccountPicker label="Cuenta asociada" value={acc} onChange={setAcc} />
        <Input label="Límite de gasto" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
        {feedback}
        <Button title="Crear" onPress={() => exec(cmd.createVirtualCard(acc!, parseAmount(limit), !!oneTime), 'Tarjeta creada. Ya podés usarla online.')} />
      </Card>
      {virtual.map((c) => <CardVisual key={c.id} card={c} onPress={() => router.push(`/tarjeta/${c.id}`)} />)}
    </Screen>
  );
}

function CardPin({ cardId }: { cardId?: string }) {
  const { card, picker } = useSelected(cardId, (c) => !c.virtual);
  const { exec, feedback } = useAction();
  const [cur, setCur] = useState(''); const [pin, setPin] = useState(''); const [conf, setConf] = useState('');
  if (!card) return <EmptyState text="Sin tarjetas físicas" />;
  return (
    <Card>
      <Text variant="heading">Cambiar PIN</Text>
      {picker}
      <Input label="PIN actual" value={cur} onChangeText={setCur} keyboardType="number-pad" secureTextEntry maxLength={4} hint="Demo: débito 1234 · crédito 4321" />
      <Input label="Nuevo PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />
      <Input label="Repetir nuevo PIN" value={conf} onChangeText={setConf} keyboardType="number-pad" secureTextEntry maxLength={4} />
      {feedback}
      <Button title="Cambiar PIN" onPress={async () => { if (await exec(cmd.changeCardPin(card.id, cur, pin, conf), 'PIN actualizado.')) { setCur(''); setPin(''); setConf(''); } }} />
    </Card>
  );
}

function CardLimit({ cardId }: { cardId?: string }) {
  const { card, picker } = useSelected(cardId);
  const { exec, feedback } = useAction();
  const [limit, setLimit] = useState('');
  if (!card) return <EmptyState text="Sin tarjetas" />;
  return (
    <Card>
      <Text variant="heading">Límite de gasto</Text>
      {picker}
      <KeyValue k="Límite actual" v={money(card.limit)} />
      <KeyValue k="Consumido" v={money(card.used)} />
      <Progress value={card.used / card.limit} />
      <Input label="Nuevo límite" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
      {feedback}
      <Button title="Guardar límite" onPress={async () => { if (await exec(cmd.setCardLimit(card.id, parseAmount(limit)), 'Límite actualizado.')) setLimit(''); }} />
    </Card>
  );
}

function CardOnline({ cardId }: { cardId?: string }) {
  const { card, picker } = useSelected(cardId);
  const { exec, feedback } = useAction();
  if (!card) return <EmptyState text="Sin tarjetas" />;
  return (
    <Card>
      {picker}
      <ToggleRow title="Compras online" subtitle="Permitir comercio electrónico" value={card.onlineEnabled} onChange={(v) => exec(cmd.setCardFlag(card.id, 'onlineEnabled', v), 'Preferencia guardada.')} />
      <ToggleRow title="Uso en el exterior" subtitle="Permitir compras fuera del país" value={card.abroadEnabled} onChange={(v) => exec(cmd.setCardFlag(card.id, 'abroadEnabled', v), 'Preferencia guardada.')} />
      {feedback}
    </Card>
  );
}

function TravelNotice() {
  const { card, picker } = useSelected();
  const { exec, feedback } = useAction();
  const [country, setCountry] = useState(''); const [from, setFrom] = useState(isoDay(7)); const [to, setTo] = useState(isoDay(21));
  return (
    <Screen><Card>
      <Text variant="heading">Aviso de viaje</Text>
      <Text tone="muted" variant="bodySmall">Evitá rechazos por seguridad cuando usás tu tarjeta en otro país.</Text>
      {picker}
      {card?.travelNotice ? <Banner kind="info" text={`Aviso vigente: ${card.travelNotice.country} del ${date(card.travelNotice.from)} al ${date(card.travelNotice.to)}`} /> : null}
      <Input label="País de destino" value={country} onChangeText={setCountry} />
      <Input label="Desde (AAAA-MM-DD)" value={from} onChangeText={setFrom} />
      <Input label="Hasta (AAAA-MM-DD)" value={to} onChangeText={setTo} />
      {feedback}
      <Button title="Registrar viaje" icon="airplane-outline" onPress={() => card && exec(cmd.setTravelNotice(card.id, country, from, to), 'Aviso registrado. Uso en el exterior habilitado.')} />
    </Card></Screen>
  );
}

function CreditStatement() {
  const { state } = useBank();
  const { card, picker } = useSelected(undefined, (c) => c.kind === 'credito');
  if (!card) return <Screen><EmptyState text="No tenés tarjetas de crédito" /></Screen>;
  const st = L.creditCardStatement(card);
  const purchases = state.transactions.filter((t) => t.type === 'card').slice(0, 10);
  return (
    <Screen>
      {picker}
      <Card>
        <Text variant="heading">Resumen de tarjeta</Text>
        <KeyValue k="Saldo a pagar" v={money(st.balance)} />
        <KeyValue k="Pago mínimo" v={money(st.minimum)} />
        <KeyValue k="Vencimiento" v={date(st.dueDate)} />
        <KeyValue k="Disponible" v={money(st.available)} />
        <Progress value={card.used / card.limit} />
        <Button title="Pagar tarjeta" onPress={() => router.push('/feature/pay-credit-card')} />
      </Card>
      <Card>
        <Text variant="heading">Consumos recientes</Text>
        {purchases.map((t) => <KeyValue key={t.id} k={`${date(t.date)} · ${t.description}`} v={money(t.amount)} />)}
      </Card>
    </Screen>
  );
}

function Installments() {
  const { card, picker } = useSelected(undefined, (c) => c.kind === 'credito');
  const { exec, feedback } = useAction();
  const [merchant, setMerchant] = useState(''); const [amount, setAmount] = useState('600'); const [months, setMonths] = useState(6);
  const rate = months <= 3 ? 0 : months <= 6 ? 18 : 32;
  const plan = L.installmentPlan(parseAmount(amount) || 0, months, rate);
  return (
    <Screen><Card>
      <Text variant="heading">Compras en cuotas</Text>
      {picker}
      <Input label="Comercio" value={merchant} onChangeText={setMerchant} placeholder="Ej: Tienda Electro" />
      <Input label="Monto de la compra" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Chips label="Cuotas" options={[1, 3, 6, 12, 18].map((m) => ({ label: `${m}`, value: m }))} value={months} onChange={setMonths} />
      <KeyValue k="Tasa (TNA)" v={rate ? `${rate}%` : 'Sin interés'} />
      <KeyValue k="Cuota" v={money(plan.quota)} />
      <KeyValue k="Total financiado" v={money(plan.total)} />
      <KeyValue k="Intereses" v={money(plan.interest)} />
      {feedback}
      {card ? <Button title="Confirmar compra en cuotas" onPress={() => exec(cmd.cardPurchase(card.id, `${merchant || 'Compra'} (${months} cuotas)`, plan.total), 'Compra registrada en tu tarjeta.')} /> : null}
    </Card></Screen>
  );
}

function LimitIncrease() {
  const { card, picker } = useSelected(undefined, (c) => c.kind === 'credito');
  const { exec, feedback } = useAction();
  const [amount, setAmount] = useState('');
  return (
    <Screen><Card>
      <Text variant="heading">Solicitar aumento de límite</Text>
      {picker}
      {card ? <KeyValue k="Límite actual" v={money(card.limit)} /> : null}
      {card?.limitRequest ? <Banner kind="info" text={`Última solicitud: ${money(card.limitRequest.amount)} · ${card.limitRequest.status}`} /> : null}
      <Input label="Nuevo límite deseado" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" hint="Evaluamos al instante según tus ingresos (hasta 3x)." />
      {feedback}
      <Button title="Solicitar" onPress={() => card && exec(cmd.requestLimitIncrease(card.id, parseAmount(amount)), 'Solicitud evaluada. Revisá tus notificaciones.')} />
    </Card></Screen>
  );
}

/** Pantalla integral de una tarjeta (ruta /tarjeta/[id]). */
export function CardDetail({ cardId }: { cardId: string }) {
  const { state } = useBank();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return <Screen><EmptyState text="Tarjeta no encontrada" /></Screen>;
  return (
    <Screen>
      <RevealCard cardId={cardId} />
      {card.status !== 'cancelada' ? (
        <>
          <LockCard cardId={cardId} />
          <CardOnline cardId={cardId} />
          <CardLimit cardId={cardId} />
          {!card.virtual ? <CardPin cardId={cardId} /> : null}
        </>
      ) : <Banner kind="info" text="Tarjeta cancelada." />}
    </Screen>
  );
}

export const cardFeatures: Feature[] = [
  { id: 'cards-list', module: 'tarjetas', title: 'Mis tarjetas', description: 'Débito, crédito y virtuales', icon: 'card-outline', Component: CardsList },
  { id: 'card-lock', module: 'tarjetas', title: 'Bloqueo temporal', description: 'Pausá y reactivá al instante', icon: 'lock-closed-outline', Component: () => <Screen><LockCard /></Screen> },
  { id: 'card-report', module: 'tarjetas', title: 'Denuncia por robo o pérdida', description: 'Cancelación y reposición', icon: 'alert-circle-outline', Component: ReportCard },
  { id: 'card-reveal', module: 'tarjetas', title: 'Ver datos de la tarjeta', description: 'Número y CVV con token', icon: 'eye-outline', Component: () => <Screen><RevealCard /></Screen> },
  { id: 'virtual-card', module: 'tarjetas', title: 'Tarjeta virtual', description: 'Creala al instante', icon: 'cloud-outline', Component: () => <VirtualCard /> },
  { id: 'one-time-card', module: 'tarjetas', title: 'Tarjeta de un solo uso', description: 'Máxima seguridad online', icon: 'flash-off-outline', Component: () => <VirtualCard oneTime /> },
  { id: 'card-pin', module: 'tarjetas', title: 'Cambiar PIN', description: 'De tus tarjetas físicas', icon: 'keypad-outline', Component: () => <Screen><CardPin /></Screen> },
  { id: 'card-limit', module: 'tarjetas', title: 'Límite de gasto', description: 'Controlá cuánto gastás', icon: 'speedometer-outline', Component: () => <Screen><CardLimit /></Screen> },
  { id: 'card-online', module: 'tarjetas', title: 'Compras online y exterior', description: 'Activá o desactivá', icon: 'globe-outline', Component: () => <Screen><CardOnline /></Screen> },
  { id: 'travel-notice', module: 'tarjetas', title: 'Aviso de viaje', description: 'Usá tu tarjeta afuera sin rechazos', icon: 'airplane-outline', Component: TravelNotice },
  { id: 'credit-statement', module: 'tarjetas', title: 'Resumen de tarjeta de crédito', description: 'Saldo, mínimo y vencimiento', icon: 'document-outline', Component: CreditStatement },
  { id: 'installments', module: 'tarjetas', title: 'Compras en cuotas', description: 'Simulá y financiá', icon: 'layers-outline', Component: Installments },
  { id: 'limit-increase', module: 'tarjetas', title: 'Aumento de límite', description: 'Evaluación instantánea', icon: 'trending-up-outline', Component: LimitIncrease },
];
