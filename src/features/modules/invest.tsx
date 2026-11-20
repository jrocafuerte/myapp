import React, { useState } from 'react';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import type { Insurance, MarketAsset } from '../../store/types';
import {
  AccountPicker, Banner, Button, Card, Chips, ConfirmButton, EmptyState, Inline, Input, KeyValue, ListItem, Screen, Text, useAction,
} from '../../ui/kit';
import { date, money, parseAmount, pct } from '../../utils/format';
import type { Feature } from '../types';

const useUsdAccount = () => { const { state } = useBank(); return state.accounts.find((a) => a.isPrimary && a.currency === 'USD' && !a.closed)?.id ?? state.accounts.find((a) => a.currency === 'USD' && !a.closed)?.id; };
const typeLabel: Record<MarketAsset['type'], string> = { accion: 'Acción', fondo: 'Fondo', cripto: 'Cripto', bono: 'Bono', etf: 'ETF' };

function AssetRow({ a }: { a: MarketAsset }) {
  return <ListItem icon={a.type === 'cripto' ? 'logo-bitcoin' : a.type === 'fondo' ? 'albums-outline' : 'trending-up-outline'} title={`${a.symbol} · ${a.name}`}
    subtitle={`${typeLabel[a.type]} · riesgo ${'●'.repeat(a.risk)}${'○'.repeat(5 - a.risk)}`} right={`${money(a.price)}  ${pct(a.change)}`} rightTone={a.change >= 0 ? 'success' : 'danger'} />;
}

function Portfolio() {
  const { state } = useBank();
  const p = L.portfolio(state);
  const hidden = state.settings.hideBalances;
  return (
    <Screen>
      <Card>
        <Text tone="muted">Valor total invertido</Text>
        <Text variant="title" weight="heavy">{money(p.total, 'USD', { hidden })}</Text>
        <KeyValue k="Ganancia/pérdida no realizada" v={money(p.pnl, 'USD', { sign: true, hidden })} />
        <KeyValue k="Plazos fijos" v={money(p.fixedDeposits, 'USD', { hidden })} />
        <KeyValue k="Perfil de inversor" v={state.settings.investorProfile ?? 'Sin definir'} />
      </Card>
      <Card>
        <Text variant="heading">Posiciones</Text>
        {p.rows.length === 0 ? <EmptyState text="Todavía no invertiste" /> : p.rows.map((r) => (
          <ListItem key={r.symbol} icon="pie-chart-outline" title={`${r.symbol} · ${r.qty.toFixed(r.asset.type === 'cripto' ? 6 : 2)} u.`}
            subtitle={`Precio prom. ${money(r.avgPrice)} · actual ${money(r.asset.price)}`} right={`${money(r.value, 'USD', { hidden })} (${pct(r.pnlPct)})`} rightTone={r.pnl >= 0 ? 'success' : 'danger'} />
        ))}
      </Card>
      <Text variant="caption" tone="muted">Las cotizaciones se actualizan cada pocos segundos (datos simulados).</Text>
    </Screen>
  );
}

function Buy({ filter }: { filter?: MarketAsset['type'][] }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const assets = state.market.filter((a) => !filter || filter.includes(a.type));
  const [sym, setSym] = useState(assets[0]?.symbol); const [amount, setAmount] = useState('100'); const [acc, setAcc] = useState(useUsdAccount());
  const a = state.market.find((x) => x.symbol === sym);
  const n = parseAmount(amount) || 0;
  return (
    <Screen>
      <Card>
        <Text variant="heading">Comprar</Text>
        <Chips options={assets.map((x) => ({ label: x.symbol, value: x.symbol }))} value={sym} onChange={setSym} />
        {a ? <AssetRow a={a} /> : null}
        <AccountPicker label="Debitar de (USD)" value={acc} onChange={setAcc} currency="USD" />
        <Input label="Monto a invertir (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        {a && n > 0 ? <KeyValue k="Recibirás aprox." v={`${((n * 0.995) / a.price).toFixed(6)} u. (comisión 0.5%)`} /> : null}
        {a && a.risk >= 4 && state.settings.investorProfile !== 'agresivo' && state.settings.investorProfile !== 'moderado' ? <Banner kind="info" text="Instrumento de alto riesgo: requiere completar el test de perfil de inversor." /> : null}
        {feedback}
        <Button title="Confirmar compra" disabled={!a || !acc} onPress={() => exec((s) => L.buyAsset(s, acc!, sym!, n), `Compraste ${sym}.`)} />
      </Card>
      <Card><Text variant="heading">Opciones disponibles</Text>{assets.map((x) => <AssetRow key={x.symbol} a={x} />)}</Card>
    </Screen>
  );
}

function Sell() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [sym, setSym] = useState(state.holdings[0]?.symbol); const [qty, setQty] = useState(''); const [acc, setAcc] = useState(useUsdAccount());
  const h = state.holdings.find((x) => x.symbol === sym); const a = state.market.find((x) => x.symbol === sym);
  if (!state.holdings.length) return <Screen><EmptyState text="No tenés posiciones para vender" /></Screen>;
  return (
    <Screen><Card>
      <Text variant="heading">Vender</Text>
      <Chips options={state.holdings.map((x) => ({ label: x.symbol, value: x.symbol }))} value={sym} onChange={setSym} />
      {h && a ? <KeyValue k="Tenencia" v={`${h.qty.toFixed(6)} u. · ${money(h.qty * a.price)}`} /> : null}
      <Inline gap="sm">
        {[0.25, 0.5, 1].map((f) => <Button key={f} small variant="secondary" title={`${f * 100}%`} onPress={() => h && setQty(String(+(h.qty * f).toFixed(8)))} />)}
      </Inline>
      <Input label="Cantidad" value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      {a && parseAmount(qty) > 0 ? <KeyValue k="Recibirás aprox." v={money(parseAmount(qty) * a.price * 0.995)} /> : null}
      <AccountPicker label="Acreditar en (USD)" value={acc} onChange={setAcc} currency="USD" />
      {feedback}
      <Button title="Confirmar venta" onPress={() => { if (exec((s) => L.sellAsset(s, acc!, sym!, parseAmount(qty)), `Vendiste ${sym}.`)) setQty(''); }} />
    </Card></Screen>
  );
}

function MarketQuotes() {
  const { state } = useBank();
  const [type, setType] = useState<MarketAsset['type'] | 'todos'>('todos');
  const list = state.market.filter((a) => type === 'todos' || a.type === type);
  return (
    <Screen>
      <Chips options={[{ label: 'Todos', value: 'todos' as const }, ...(['accion', 'etf', 'fondo', 'bono', 'cripto'] as const).map((t) => ({ label: typeLabel[t], value: t }))]} value={type} onChange={setType} />
      <Card>{list.map((a) => <AssetRow key={a.symbol} a={a} />)}</Card>
      <Text variant="caption" tone="muted">Actualización automática · datos simulados con fines demostrativos.</Text>
    </Screen>
  );
}

function FxExchange() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [from, setFrom] = useState(state.accounts.find((a) => a.currency === 'USD' && !a.closed)?.id); const [to, setTo] = useState(state.accounts.find((a) => a.currency !== 'USD' && !a.closed)?.id); const [amount, setAmount] = useState('');
  const fa = state.accounts.find((a) => a.id === from); const ta = state.accounts.find((a) => a.id === to);
  const q = fa && ta ? L.fxQuote(fa.currency, ta.currency) : null;
  return (
    <Screen><Card>
      <Text variant="heading">Compra / venta de divisas</Text>
      <AccountPicker label="Vendo desde" value={from} onChange={setFrom} />
      <AccountPicker label="Compro en" value={to} onChange={setTo} exclude={from} />
      {q && fa && ta ? <KeyValue k="Tipo de cambio" v={`1 ${fa.currency} = ${q.rate.toFixed(4)} ${ta.currency}`} /> : null}
      <Input label={`Monto en ${fa?.currency ?? ''}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {q && ta && parseAmount(amount) > 0 ? <KeyValue k="Recibís" v={money(parseAmount(amount) * q.rate, ta.currency)} /> : null}
      {feedback}
      <Button title="Operar" disabled={!from || !to} onPress={() => { if (exec((s) => L.exchangeCurrency(s, from!, to!, parseAmount(amount)), 'Operación de cambio realizada.')) setAmount(''); }} />
    </Card></Screen>
  );
}

const PROFILE_QS: { q: string; opts: string[] }[] = [
  { q: '¿Cuál es tu horizonte de inversión?', opts: ['Menos de 1 año', '1 a 3 años', 'Más de 3 años'] },
  { q: 'Si tu inversión cae 20%, ¿qué hacés?', opts: ['Vendo todo', 'Espero', 'Compro más'] },
  { q: '¿Cuánta experiencia tenés invirtiendo?', opts: ['Ninguna', 'Algo', 'Mucha'] },
  { q: '¿Qué porcentaje de tus ahorros invertirías?', opts: ['Menos de 10%', '10% a 40%', 'Más de 40%'] },
  { q: '¿Qué priorizás?', opts: ['Preservar capital', 'Equilibrio', 'Máxima rentabilidad'] },
];
function InvestorProfile() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [ans, setAns] = useState<number[]>(Array(5).fill(-1));
  return (
    <Screen>
      {state.settings.investorProfile ? <Banner kind="info" text={`Tu perfil actual: ${state.settings.investorProfile}`} /> : null}
      {PROFILE_QS.map((p, i) => (
        <Card key={p.q}><Chips label={`${i + 1}. ${p.q}`} options={p.opts.map((o, j) => ({ label: o, value: j }))} value={ans[i] === -1 ? undefined : ans[i]} onChange={(v) => setAns(ans.map((x, k) => (k === i ? v : x)))} /></Card>
      ))}
      {feedback}
      <Button title="Calcular perfil" disabled={ans.includes(-1)} onPress={() => exec((s) => L.setInvestorProfile(s, ans), `Tu perfil es ${L.investorProfile(ans)}.`)} />
    </Screen>
  );
}

/* --------------------------------- Seguros ------------------------------- */
const INS_TYPES = Object.keys(L.INSURANCE_BASE) as Insurance['type'][];
function MyInsurance() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  return (
    <Screen>
      {feedback}
      {state.insurances.length === 0 ? <EmptyState text="No tenés seguros contratados" /> : state.insurances.map((i) => (
        <Card key={i.id}>
          <ListItem icon="umbrella-outline" title={`Seguro de ${i.type}`} subtitle={`${i.status} · desde ${date(i.start)}`} right={`${money(i.premium)}/mes`} />
          <KeyValue k="Cobertura" v={money(i.coverage)} />
          {i.status === 'vigente' ? <ConfirmButton small title="Dar de baja" variant="ghost" onConfirm={() => exec((s) => L.cancelInsurance(s, i.id), 'Seguro dado de baja.')} /> : null}
        </Card>
      ))}
      {state.claims.length ? <Card><Text variant="heading">Siniestros</Text>{state.claims.map((c) => <ListItem key={c.id} icon="document-text-outline" title={c.description.slice(0, 40)} subtitle={`${date(c.date)} · ${c.status}`} />)}</Card> : null}
    </Screen>
  );
}

function QuoteInsurance({ contract }: { contract?: boolean }) {
  const { exec, feedback } = useAction();
  const [type, setType] = useState<Insurance['type']>('Vida'); const [coverage, setCoverage] = useState('50000'); const [acc, setAcc] = useState(useUsdAccount());
  let premium: number | null = null; let err: string | null = null;
  try { premium = L.quoteInsurance(type, parseAmount(coverage) || 0); } catch (e) { err = (e as Error).message; }
  return (
    <Screen><Card>
      <Text variant="heading">{contract ? 'Contratar seguro' : 'Cotizar seguro'}</Text>
      <Chips label="Tipo" options={INS_TYPES.map((t) => ({ label: t, value: t }))} value={type} onChange={setType} />
      <Input label={`Suma asegurada (${L.INSURANCE_BASE[type].min}–${L.INSURANCE_BASE[type].max})`} value={coverage} onChangeText={setCoverage} keyboardType="decimal-pad" />
      {premium !== null ? <KeyValue k="Prima mensual" v={money(premium)} /> : <Banner kind="error" text={err} />}
      {contract ? (
        <>
          <AccountPicker label="Débito mensual de" value={acc} onChange={setAcc} />
          {feedback}
          <Button title="Contratar" disabled={premium === null} onPress={() => exec((s) => L.contractInsurance(s, type, parseAmount(coverage), acc!), `¡Seguro de ${type} contratado!`)} />
        </>
      ) : null}
    </Card></Screen>
  );
}

function FileClaim() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const active = state.insurances.filter((i) => i.status === 'vigente');
  const [ins, setIns] = useState(active[0]?.id); const [desc, setDesc] = useState('');
  if (!active.length) return <Screen><EmptyState text="No tenés seguros vigentes" /></Screen>;
  return (
    <Screen><Card>
      <Text variant="heading">Denunciar siniestro</Text>
      <Chips label="Seguro" options={active.map((i) => ({ label: i.type, value: i.id }))} value={ins} onChange={setIns} />
      <Input label="¿Qué pasó?" value={desc} onChangeText={setDesc} multiline placeholder="Describí fecha, lugar y lo ocurrido" />
      {feedback}
      <Button title="Enviar denuncia" onPress={() => { if (exec((s) => L.fileClaim(s, ins!, desc), 'Denuncia recibida. Te contactaremos en 48 h.')) setDesc(''); }} />
    </Card></Screen>
  );
}

export const investFeatures: Feature[] = [
  { id: 'portfolio', module: 'inversiones', title: 'Mi portafolio', description: 'Posiciones y rendimiento', icon: 'briefcase-outline', Component: Portfolio },
  { id: 'buy-asset', module: 'inversiones', title: 'Comprar acciones y ETF', description: 'Operá en el mercado', icon: 'add-circle-outline', Component: () => <Buy filter={['accion', 'etf', 'bono']} /> },
  { id: 'sell-asset', module: 'inversiones', title: 'Vender inversiones', description: 'Rescatá tus posiciones', icon: 'remove-circle-outline', Component: Sell },
  { id: 'funds', module: 'inversiones', title: 'Fondos de inversión', description: 'Renta fija, mixtos y acciones', icon: 'albums-outline', Component: () => <Buy filter={['fondo']} /> },
  { id: 'market-quotes', module: 'inversiones', title: 'Cotizaciones', description: 'Precios en tiempo real', icon: 'pulse-outline', Component: MarketQuotes },
  { id: 'fx-exchange', module: 'inversiones', title: 'Compra/venta de divisas', description: 'USD, EUR, GBP', icon: 'cash-outline', Component: FxExchange },
  { id: 'crypto', module: 'inversiones', title: 'Criptomonedas', description: 'BTC, ETH y stablecoins', icon: 'logo-bitcoin', Component: () => <Buy filter={['cripto']} /> },
  { id: 'investor-profile', module: 'inversiones', title: 'Perfil de inversor', description: 'Test de 5 preguntas', icon: 'person-outline', Component: InvestorProfile },

  { id: 'my-insurance', module: 'seguros', title: 'Mis seguros', description: 'Pólizas y siniestros', icon: 'umbrella-outline', Component: MyInsurance },
  { id: 'contract-insurance', module: 'seguros', title: 'Contratar seguro', description: 'Vida, hogar, auto y más', icon: 'shield-outline', Component: () => <QuoteInsurance contract /> },
  { id: 'quote-insurance', module: 'seguros', title: 'Cotizar seguro', description: 'Prima al instante', icon: 'calculator-outline', Component: () => <QuoteInsurance /> },
  { id: 'file-claim', module: 'seguros', title: 'Denunciar siniestro', description: 'Iniciá tu reclamo', icon: 'document-attach-outline', Component: FileClaim },
];
