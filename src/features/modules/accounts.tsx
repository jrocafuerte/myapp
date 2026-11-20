import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Share } from 'react-native';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import type { Account, Category, Currency, Transaction } from '../../store/types';
import {
  AccountPicker, Banner, BarList, Button, Card, Chips, ConfirmButton, EmptyState, Inline, Input, KeyValue, ListItem, Screen, Stack, Stat, Text, useAction,
} from '../../ui/kit';
import { date, money, monthLabel } from '../../utils/format';
import type { Feature } from '../types';

export const CATEGORIES: Category[] = ['Supermercado', 'Restaurantes', 'Transporte', 'Servicios', 'Salud', 'Entretenimiento', 'Compras',
  'Educación', 'Vivienda', 'Suscripciones', 'Transferencias', 'Ingresos', 'Inversiones', 'Ahorro', 'Préstamos', 'Impuestos', 'Comisiones', 'Otros'];

const typeLabel: Record<Account['type'], string> = { ahorro: 'Caja de ahorro', corriente: 'Cuenta corriente', nomina: 'Cuenta nómina' };

const usePrimary = () => { const { state } = useBank(); return state.accounts.find((a) => a.isPrimary && !a.closed)?.id ?? state.accounts.find((a) => !a.closed)?.id; };

/* -------------------------------- Cuentas -------------------------------- */
function BalanceSummary() {
  const { state } = useBank();
  const cur = state.settings.displayCurrency; const hidden = state.settings.hideBalances;
  const active = state.accounts.filter((a) => !a.closed);
  const p = L.portfolio(state);
  const debt = state.loans.filter((l) => l.status === 'activo').reduce((a, l) => a + l.outstanding, 0) + state.cards.filter((c) => c.kind === 'credito').reduce((a, c) => a + c.used, 0);
  const cash = L.totalBalance(state, cur);
  const goals = state.goals.reduce((a, g) => a + g.saved, 0);
  return (
    <Screen>
      <Card>
        <Text tone="muted">Patrimonio neto estimado</Text>
        <Text variant="title" weight="heavy">{money(cash + L.convert(p.total + goals - debt, 'USD', cur), cur, { hidden })}</Text>
        <Inline>
          <Stat label="Cuentas" value={money(cash, cur, { hidden })} />
          <Stat label="Inversiones" value={money(L.convert(p.total, 'USD', cur), cur, { hidden })} />
        </Inline>
        <Inline>
          <Stat label="Metas de ahorro" value={money(L.convert(goals, 'USD', cur), cur, { hidden })} />
          <Stat label="Deudas" value={money(-L.convert(debt, 'USD', cur), cur, { hidden })} />
        </Inline>
      </Card>
      <Card>
        <Text variant="heading">Por moneda</Text>
        {(['USD', 'EUR', 'GBP'] as Currency[]).map((c) => {
          const sum = active.filter((a) => a.currency === c).reduce((t, a) => t + a.balance, 0);
          return sum ? <KeyValue key={c} k={c} v={money(sum, c, { hidden })} /> : null;
        })}
      </Card>
    </Screen>
  );
}

export function AccountsList() {
  const { state } = useBank();
  return (
    <Screen>
      {state.accounts.filter((a) => !a.closed).map((a) => (
        <Card key={a.id}>
          <ListItem icon={a.currency === 'USD' ? 'logo-usd' : a.currency === 'EUR' ? 'logo-euro' : 'cash-outline'} title={`${a.alias}${a.isPrimary ? ' ★' : ''}`}
            subtitle={`${typeLabel[a.type]} · ${a.number}`} right={money(a.balance, a.currency, { hidden: state.settings.hideBalances })}
            onPress={() => router.push(`/cuenta/${a.id}`)} />
        </Card>
      ))}
      <Button title="Abrir nueva cuenta" icon="add" variant="secondary" onPress={() => router.push('/feature/open-account')} />
    </Screen>
  );
}

/** Detalle completo de una cuenta (también usado por la ruta /cuenta/[id]). */
export function AccountDetail({ accountId }: { accountId?: string }) {
  const { state } = useBank();
  const primary = usePrimary();
  const [id, setId] = useState(accountId ?? primary);
  const acc = state.accounts.find((a) => a.id === id);
  const { exec, feedback } = useAction();
  const [alias, setAlias] = useState('');
  if (!acc) return <Screen><EmptyState text="Cuenta no encontrada" /></Screen>;
  const txs = state.transactions.filter((t) => t.accountId === acc.id).slice(0, 8);
  return (
    <Screen>
      {!accountId ? <AccountPicker value={id} onChange={setId} /> : null}
      <Card>
        <Text tone="muted">{typeLabel[acc.type]} · {acc.currency}</Text>
        <Text variant="title" weight="heavy">{money(acc.balance, acc.currency, { hidden: state.settings.hideBalances })}</Text>
        <KeyValue k="Alias" v={acc.alias} />
        <KeyValue k="Número" v={acc.number} selectable />
        <KeyValue k="Código interbancario" v={acc.interbankCode} selectable />
        <KeyValue k="Apertura" v={date(acc.createdAt)} />
        <KeyValue k="Principal" v={acc.isPrimary ? 'Sí' : 'No'} />
      </Card>
      <ShareAccountActions account={acc} />
      <Card>
        <Text variant="heading">Personalizar</Text>
        <Input label="Nuevo alias" value={alias} onChangeText={setAlias} placeholder={acc.alias} />
        <Button title="Renombrar" variant="secondary" onPress={() => { if (exec((s) => L.renameAccount(s, acc.id, alias), 'Alias actualizado.')) setAlias(''); }} />
        {!acc.isPrimary ? <Button title="Marcar como principal" variant="ghost" icon="star-outline" onPress={() => exec((s) => L.setPrimaryAccount(s, acc.id), 'Cuenta principal actualizada.')} /> : null}
        {feedback}
      </Card>
      <Card>
        <Text variant="heading">Últimos movimientos</Text>
        {txs.length ? txs.map((t) => <TxRow key={t.id} tx={t} />) : <EmptyState text="Sin movimientos" />}
      </Card>
    </Screen>
  );
}

function ShareAccountActions({ account }: { account: Account }) {
  const { state } = useBank();
  const [copied, setCopied] = useState<string | null>(null);
  const text = `Titular: ${state.user.name}\nBanco: Banco Plus\nCuenta: ${account.number}\nCódigo interbancario: ${account.interbankCode}\nMoneda: ${account.currency}\nAlias: ${account.alias}`;
  return (
    <Card>
      <Text variant="heading">Compartir datos</Text>
      <Inline gap="sm">
        <Stack flex><Button title="Copiar" icon="copy-outline" variant="secondary" onPress={async () => { await Clipboard.setStringAsync(text); setCopied('Datos copiados al portapapeles.'); }} /></Stack>
        <Stack flex><Button title="Compartir" icon="share-outline" onPress={() => Share.share({ message: text }).catch(() => {})} /></Stack>
      </Inline>
      <Banner kind="success" text={copied} />
    </Card>
  );
}

function ShareAccount() {
  const { state } = useBank();
  const [id, setId] = useState(usePrimary());
  const acc = state.accounts.find((a) => a.id === id);
  return <Screen><AccountPicker value={id} onChange={setId} />{acc ? <ShareAccountActions account={acc} /> : null}</Screen>;
}

function OpenAccount() {
  const { exec, feedback } = useAction();
  const [type, setType] = useState<Account['type']>('ahorro'); const [cur, setCur] = useState<Currency>('USD'); const [alias, setAlias] = useState('');
  return (
    <Screen>
      <Card>
        <Text variant="heading">Abrir una cuenta nueva</Text>
        <Chips label="Tipo" options={[{ label: 'Caja de ahorro', value: 'ahorro' }, { label: 'Cuenta corriente', value: 'corriente' }]} value={type} onChange={setType} />
        <Chips label="Moneda" options={[{ label: 'Dólares (USD)', value: 'USD' }, { label: 'Euros (EUR)', value: 'EUR' }, { label: 'Libras (GBP)', value: 'GBP' }]} value={cur} onChange={setCur} />
        <Input label="Alias" value={alias} onChangeText={setAlias} placeholder="Ej: Ahorro auto" />
        <Text variant="caption" tone="muted">Sin costo de mantenimiento. Al abrirla aceptás los términos y condiciones vigentes.</Text>
        {feedback}
        <Button title="Abrir cuenta" onPress={() => { if (exec((s) => L.openAccount(s, type, cur, alias), '¡Cuenta abierta! Ya podés usarla.')) setAlias(''); }} />
      </Card>
    </Screen>
  );
}

function RenameAccount() {
  const { exec, feedback } = useAction();
  const [id, setId] = useState(usePrimary()); const [alias, setAlias] = useState('');
  return (
    <Screen><Card>
      <AccountPicker value={id} onChange={setId} />
      <Input label="Nuevo alias (3-24 caracteres)" value={alias} onChangeText={setAlias} />
      {feedback}
      <Button title="Guardar alias" onPress={() => { if (id && exec((s) => L.renameAccount(s, id, alias), 'Alias actualizado.')) setAlias(''); }} />
    </Card></Screen>
  );
}

function PrimaryAccount() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  return (
    <Screen><Card>
      <Text variant="heading">Cuenta principal</Text>
      <Text tone="muted" variant="bodySmall">Se usa por defecto en pagos, transferencias y para acreditar ingresos.</Text>
      <AccountPicker label="Elegí tu cuenta principal" value={state.accounts.find((a) => a.isPrimary)?.id} onChange={(id) => exec((s) => L.setPrimaryAccount(s, id), 'Cuenta principal actualizada.')} />
      {feedback}
    </Card></Screen>
  );
}

function CloseAccount() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [id, setId] = useState<string>();
  const acc = state.accounts.find((a) => a.id === id);
  return (
    <Screen><Card>
      <Text variant="heading">Cerrar una cuenta</Text>
      <Text tone="muted" variant="bodySmall">La cuenta debe tener saldo cero, no ser la principal y no tener tarjetas activas.</Text>
      <AccountPicker value={id} onChange={setId} />
      {feedback}
      {acc ? <ConfirmButton title={`Cerrar ${acc.alias}`} variant="danger" onConfirm={() => exec((s) => L.closeAccount(s, acc.id), 'Cuenta cerrada.')} /> : null}
    </Card></Screen>
  );
}

function MultiCurrency() {
  const { state } = useBank();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Cotizaciones (base USD)</Text>
        {(['EUR', 'GBP'] as Currency[]).map((c) => {
          const buy = L.fxQuote('USD', c).rate; const sell = L.fxQuote(c, 'USD').rate;
          return <KeyValue key={c} k={`1 ${c}`} v={`Compra ${(1 / buy).toFixed(4)} · Venta ${sell.toFixed(4)} USD`} />;
        })}
      </Card>
      <Card>
        <Text variant="heading">Tus cuentas en moneda extranjera</Text>
        {state.accounts.filter((a) => !a.closed && a.currency !== 'USD').map((a) => (
          <ListItem key={a.id} icon="globe-outline" title={a.alias} subtitle={`≈ ${money(L.convert(a.balance, a.currency, 'USD'))}`} right={money(a.balance, a.currency, { hidden: state.settings.hideBalances })} />
        ))}
        <Button title="Comprar/vender divisas" variant="secondary" onPress={() => router.push('/feature/fx-exchange')} />
        <Button title="Abrir cuenta en otra moneda" variant="ghost" onPress={() => router.push('/feature/open-account')} />
      </Card>
    </Screen>
  );
}

function AccountCertificate() {
  const { state } = useBank();
  const [id, setId] = useState(usePrimary());
  const text = id ? L.accountCertificate(state, id) : '';
  return (
    <Screen>
      <AccountPicker value={id} onChange={setId} />
      <Card><Text selectable>{text}</Text></Card>
      <Button title="Compartir certificado" icon="share-outline" onPress={() => Share.share({ message: text }).catch(() => {})} />
    </Screen>
  );
}

/* ------------------------------ Movimientos ------------------------------ */
export function TxRow({ tx }: { tx: Transaction }) {
  const { state } = useBank();
  const acc = state.accounts.find((a) => a.id === tx.accountId);
  return (
    <ListItem icon={tx.amount > 0 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} title={tx.description}
      subtitle={`${date(tx.date)} · ${tx.category}${tx.note ? ' · 📝' : ''}`}
      right={money(tx.amount, acc?.currency, { sign: true, hidden: state.settings.hideBalances })} rightTone={tx.amount > 0 ? 'success' : undefined}
      onPress={() => router.push(`/movimiento/${tx.id}`)} />
  );
}

export function MovementsBrowser({ showFilters = true, focus }: { showFilters?: boolean; focus?: 'search' | 'filters' }) {
  const { state } = useBank();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'todos' | 'ingresos' | 'egresos'>('todos');
  const [accountId, setAccountId] = useState<string | undefined>();
  const [category, setCategory] = useState<Category | undefined>();
  const [limit, setLimit] = useState(30);
  const txs = useMemo(() => L.filterTx(state, { q, kind, accountId, category }), [state, q, kind, accountId, category]);
  const total = txs.reduce((a, t) => a + L.convert(t.amount, state.accounts.find((x) => x.id === t.accountId)?.currency ?? 'USD', 'USD'), 0);
  return (
    <Screen>
      <Input placeholder="Buscar por comercio, categoría, nota o referencia" value={q} onChangeText={setQ} autoFocus={focus === 'search'} />
      {showFilters ? (
        <Card>
          <Chips label="Tipo" options={[{ label: 'Todos', value: 'todos' }, { label: 'Ingresos', value: 'ingresos' }, { label: 'Egresos', value: 'egresos' }]} value={kind} onChange={setKind} />
          <Chips label="Cuenta" options={[{ label: 'Todas', value: '' }, ...state.accounts.filter((a) => !a.closed).map((a) => ({ label: a.alias, value: a.id }))]} value={accountId ?? ''} onChange={(v) => setAccountId(v || undefined)} />
          {focus === 'filters' ? <Chips label="Categoría" options={[{ label: 'Todas', value: '' as Category | '' }, ...CATEGORIES.map((c) => ({ label: c, value: c as Category | '' }))]} value={category ?? ''} onChange={(v) => setCategory(v || undefined)} /> : null}
        </Card>
      ) : null}
      <Text tone="muted" variant="bodySmall">{txs.length} movimientos · neto {money(total, 'USD', { sign: true, hidden: state.settings.hideBalances })}</Text>
      <Card>
        {txs.length ? txs.slice(0, limit).map((t) => <TxRow key={t.id} tx={t} />) : <EmptyState text="No hay movimientos que coincidan" icon="search-outline" />}
        {txs.length > limit ? <Button title="Ver más" variant="ghost" onPress={() => setLimit(limit + 30)} /> : null}
      </Card>
    </Screen>
  );
}

export function TxDetail({ txId }: { txId?: string }) {
  const { state } = useBank();
  const [id, setId] = useState(txId ?? state.transactions[0]?.id);
  const tx = state.transactions.find((t) => t.id === id);
  const { exec, feedback } = useAction();
  const [note, setNote] = useState(tx?.note ?? '');
  if (!tx) return <Screen><EmptyState text="Movimiento no encontrado" /></Screen>;
  const acc = state.accounts.find((a) => a.id === tx.accountId);
  const receipt = `COMPROBANTE BANCO PLUS\n${tx.description}\nMonto: ${money(tx.amount, acc?.currency)}\nFecha: ${date(tx.date, true)}\nCuenta: ${acc?.alias} (${acc?.number})\nCategoría: ${tx.category}\nReferencia: ${tx.reference}${tx.counterpart ? `\nContraparte: ${tx.counterpart}` : ''}`;
  return (
    <Screen>
      {!txId ? <Chips label="Elegí un movimiento reciente" options={state.transactions.slice(0, 6).map((t) => ({ label: t.description.slice(0, 22), value: t.id }))} value={id} onChange={(v) => { setId(v); setNote(state.transactions.find((t) => t.id === v)?.note ?? ''); }} /> : null}
      <Card>
        <Text tone="muted">{tx.description}</Text>
        <Text variant="title" weight="heavy">{money(tx.amount, acc?.currency, { sign: true })}</Text>
        <KeyValue k="Fecha" v={date(tx.date, true)} />
        <KeyValue k="Cuenta" v={acc?.alias ?? '—'} />
        <KeyValue k="Tipo" v={tx.type} />
        <KeyValue k="Referencia" v={tx.reference} selectable />
        {tx.counterpart ? <KeyValue k="Contraparte" v={tx.counterpart} /> : null}
      </Card>
      <Card>
        <Text variant="heading">Categoría</Text>
        <Chips options={CATEGORIES.map((c) => ({ label: c, value: c }))} value={tx.category} onChange={(c) => exec((s) => L.setTxCategory(s, tx.id, c), `Recategorizado como ${c}.`)} />
      </Card>
      <Card>
        <Text variant="heading">Nota</Text>
        <Input value={note} onChangeText={setNote} placeholder="Ej: regalo de cumpleaños" maxLength={140} />
        <Button title="Guardar nota" variant="secondary" onPress={() => exec((s) => L.setTxNote(s, tx.id, note), 'Nota guardada.')} />
      </Card>
      {feedback}
      <Button title="Compartir comprobante" icon="share-outline" onPress={() => Share.share({ message: receipt }).catch(() => {})} />
    </Screen>
  );
}

function AutoCategory() {
  const [desc, setDesc] = useState('');
  const { state } = useBank();
  const counts = CATEGORIES.map((c) => ({ label: c, value: state.transactions.filter((t) => t.category === c).length })).filter((x) => x.value > 0);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Probá la categorización automática</Text>
        <Input value={desc} onChangeText={setDesc} placeholder="Ej: Farmacia del centro" />
        <Text>Categoría detectada: <Text weight="bold">{desc ? L.autoCategory(desc) : '—'}</Text></Text>
      </Card>
      <Card><Text variant="heading">Movimientos por categoría</Text><BarList data={counts} /></Card>
    </Screen>
  );
}

function MonthlyStatement() {
  const { state } = useBank();
  const [id, setId] = useState(usePrimary());
  const months = [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse().slice(0, 6);
  const [month, setMonth] = useState(months[0]);
  if (!id || !month) return <Screen><EmptyState text="Sin datos" /></Screen>;
  const st = L.monthlyStatement(state, id, month);
  const acc = state.accounts.find((a) => a.id === id)!;
  return (
    <Screen>
      <AccountPicker value={id} onChange={setId} />
      <Chips label="Mes" options={months.map((m) => ({ label: monthLabel(m), value: m }))} value={month} onChange={setMonth} />
      <Card>
        <Text variant="heading">Resumen {monthLabel(month)}</Text>
        <KeyValue k="Saldo inicial" v={money(st.opening, acc.currency)} />
        <KeyValue k="Ingresos" v={money(st.income, acc.currency)} />
        <KeyValue k="Egresos" v={money(-st.expenses, acc.currency)} />
        <KeyValue k="Saldo final" v={money(st.closing, acc.currency)} />
      </Card>
      <Card>{st.txs.length ? st.txs.map((t) => <TxRow key={t.id} tx={t} />) : <EmptyState text="Sin movimientos en el mes" />}</Card>
    </Screen>
  );
}

function ExportCsv() {
  const { state } = useBank();
  const [range, setRange] = useState<30 | 90 | 365>(30);
  const since = new Date(Date.now() - range * 864e5).toISOString();
  const txs = state.transactions.filter((t) => t.date >= since);
  const csv = L.toCsv(state, txs);
  return (
    <Screen>
      <Chips label="Período" options={[{ label: '30 días', value: 30 }, { label: '90 días', value: 90 }, { label: '1 año', value: 365 }]} value={range} onChange={setRange} />
      <Card>
        <Text tone="muted" variant="bodySmall">{txs.length} movimientos · vista previa</Text>
        <Text variant="micro" selectable mono>{csv.split('\n').slice(0, 8).join('\n')}</Text>
      </Card>
      <Button title="Exportar / compartir CSV" icon="download-outline" onPress={() => Share.share({ message: csv, title: 'movimientos.csv' }).catch(() => {})} />
    </Screen>
  );
}

function TxReceipt() {
  return <TxDetail />;
}

export const accountFeatures: Feature[] = [
  { id: 'balance-summary', module: 'cuentas', title: 'Resumen de patrimonio', description: 'Saldo total, inversiones y deudas', icon: 'stats-chart-outline', Component: BalanceSummary },
  { id: 'accounts-list', module: 'cuentas', title: 'Mis cuentas', description: 'Todas tus cuentas activas', icon: 'wallet-outline', Component: AccountsList },
  { id: 'account-detail', module: 'cuentas', title: 'Detalle de cuenta', description: 'Número, código interbancario y saldo', icon: 'document-text-outline', Component: () => <AccountDetail /> },
  { id: 'share-account', module: 'cuentas', title: 'Compartir datos de cuenta', description: 'Copiá o enviá tus datos', icon: 'share-social-outline', Component: ShareAccount },
  { id: 'open-account', module: 'cuentas', title: 'Abrir nueva cuenta', description: 'Ahorro o corriente, en 3 monedas', icon: 'add-circle-outline', Component: OpenAccount },
  { id: 'rename-account', module: 'cuentas', title: 'Alias de cuenta', description: 'Personalizá el nombre', icon: 'create-outline', Component: RenameAccount },
  { id: 'primary-account', module: 'cuentas', title: 'Cuenta principal', description: 'Predeterminada para operar', icon: 'star-outline', Component: PrimaryAccount },
  { id: 'close-account', module: 'cuentas', title: 'Cerrar cuenta', description: 'Baja de cuentas sin saldo', icon: 'close-circle-outline', Component: CloseAccount },
  { id: 'multi-currency', module: 'cuentas', title: 'Cuentas multimoneda', description: 'USD, EUR y GBP con cotizaciones', icon: 'globe-outline', Component: MultiCurrency },
  { id: 'account-certificate', module: 'cuentas', title: 'Certificado de cuenta', description: 'Constancia de titularidad', icon: 'ribbon-outline', Component: AccountCertificate },

  { id: 'tx-history', module: 'movimientos', title: 'Historial de movimientos', description: 'Todos tus movimientos', icon: 'list-outline', Component: () => <MovementsBrowser showFilters={false} /> },
  { id: 'tx-search', module: 'movimientos', title: 'Búsqueda de movimientos', description: 'Por comercio, nota o referencia', icon: 'search-outline', Component: () => <MovementsBrowser showFilters={false} focus="search" /> },
  { id: 'tx-filters', module: 'movimientos', title: 'Filtros avanzados', description: 'Por tipo, cuenta y categoría', icon: 'funnel-outline', Component: () => <MovementsBrowser focus="filters" /> },
  { id: 'tx-detail', module: 'movimientos', title: 'Detalle de movimiento', description: 'Toda la información de una operación', icon: 'reader-outline', Component: () => <TxDetail /> },
  { id: 'tx-receipt', module: 'movimientos', title: 'Comprobantes', description: 'Compartí el comprobante', icon: 'receipt-outline', Component: TxReceipt },
  { id: 'auto-category', module: 'movimientos', title: 'Categorización automática', description: 'Clasificación inteligente', icon: 'pricetags-outline', Component: AutoCategory },
  { id: 'recategorize', module: 'movimientos', title: 'Recategorizar movimientos', description: 'Corregí la categoría', icon: 'swap-vertical-outline', Component: () => <TxDetail /> },
  { id: 'tx-notes', module: 'movimientos', title: 'Notas en movimientos', description: 'Agregá contexto a tus gastos', icon: 'chatbox-ellipses-outline', Component: () => <TxDetail /> },
  { id: 'monthly-statement', module: 'movimientos', title: 'Estado de cuenta mensual', description: 'Saldo inicial, final y detalle', icon: 'calendar-outline', Component: MonthlyStatement },
  { id: 'export-csv', module: 'movimientos', title: 'Exportar a CSV', description: 'Descargá tus movimientos', icon: 'download-outline', Component: ExportCsv },
];
