import React, { useState } from 'react';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import type { Category, Loan } from '../../store/types';
import {
  AccountPicker, Banner, BarList, Button, Card, Chips, ColumnChart, ConfirmButton, EmptyState, Input, KeyValue, ListItem, Progress, Screen, Stack, Text, ToggleRow, useAction,
} from '../../ui/kit';
import { date, isoDay, money, monthLabel, parseAmount } from '../../utils/format';
import type { Feature } from '../types';
import { CATEGORIES } from './accounts';

const usePrimary = () => { const { state } = useBank(); return state.accounts.find((a) => a.isPrimary && !a.closed)?.id; };
const thisMonth = () => new Date().toISOString().slice(0, 7);

/* --------------------------------- Ahorro -------------------------------- */
function GoalCard({ id, actions }: { id: string; actions?: 'contribute' | 'withdraw' }) {
  const { state } = useBank();
  const g = state.goals.find((x) => x.id === id)!;
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [amount, setAmount] = useState('');
  const monthsLeft = Math.max(1, Math.ceil((new Date(`${g.deadline}T12:00:00`).getTime() - Date.now()) / (30 * 864e5)));
  const monthly = Math.max(0, (g.target - g.saved) / monthsLeft);
  return (
    <Card>
      <Text variant="heading">{g.emoji} {g.name}</Text>
      <Progress value={g.saved / g.target} />
      <KeyValue k="Ahorrado" v={`${money(g.saved)} de ${money(g.target)} (${Math.round((g.saved / g.target) * 100)}%)`} />
      <KeyValue k="Fecha objetivo" v={date(g.deadline)} />
      {g.saved < g.target ? <Text variant="caption" tone="muted">Para llegar, ahorrá {money(monthly)} por mes.</Text> : <Text weight="bold">🎉 ¡Meta cumplida!</Text>}
      {actions ? (
        <>
          <AccountPicker label={actions === 'contribute' ? 'Desde' : 'Hacia'} value={acc} onChange={setAcc} currency="USD" />
          <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Button title={actions === 'contribute' ? 'Aportar' : 'Retirar'} variant={actions === 'contribute' ? 'primary' : 'secondary'}
            onPress={() => { if (exec((s) => (actions === 'contribute' ? L.contributeGoal : L.withdrawGoal)(s, g.id, acc!, parseAmount(amount)), actions === 'contribute' ? 'Aporte realizado.' : 'Retiro realizado.')) setAmount(''); }} />
          {actions === 'withdraw' ? <ConfirmButton small title="Eliminar meta" variant="ghost" onConfirm={() => exec((s) => L.deleteGoal(s, g.id, acc!), 'Meta eliminada; el saldo volvió a tu cuenta.')} /> : null}
        </>
      ) : null}
      {feedback}
    </Card>
  );
}

function Goals() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [name, setName] = useState(''); const [target, setTarget] = useState(''); const [deadline, setDeadline] = useState(isoDay(180)); const [emoji, setEmoji] = useState('🎯');
  return (
    <Screen>
      {state.goals.map((g) => <GoalCard key={g.id} id={g.id} />)}
      <Card>
        <Text variant="heading">Nueva meta</Text>
        <Chips options={['🎯', '🏖️', '🚗', '🏠', '🎓', '💍', '🛟', '💻'].map((e) => ({ label: e, value: e }))} value={emoji} onChange={setEmoji} />
        <Input label="Nombre" value={name} onChangeText={setName} />
        <Input label="Monto objetivo" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        <Input label="Fecha límite (AAAA-MM-DD)" value={deadline} onChangeText={setDeadline} />
        {feedback}
        <Button title="Crear meta" onPress={() => { if (exec((s) => L.createGoal(s, name, parseAmount(target), deadline, emoji), 'Meta creada.')) { setName(''); setTarget(''); } }} />
      </Card>
    </Screen>
  );
}

const GoalActions = ({ mode }: { mode: 'contribute' | 'withdraw' }) => {
  const { state } = useBank();
  return <Screen>{state.goals.length ? state.goals.map((g) => <GoalCard key={g.id} id={g.id} actions={mode} />) : <EmptyState text="Creá una meta primero" />}</Screen>;
};

function RoundUp() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [goal, setGoal] = useState(state.settings.roundUpGoalId ?? state.goals[0]?.id);
  const saved = state.transactions.filter((t) => t.description.startsWith('Redondeo')).reduce((a, t) => a - t.amount, 0);
  return (
    <Screen><Card>
      <Text variant="heading">Redondeo automático</Text>
      <Text tone="muted" variant="bodySmall">Cada compra con tarjeta o pago se redondea al dólar siguiente y la diferencia va a tu meta. Ej: gastás 4.30 → ahorrás 0.70.</Text>
      <Chips label="Meta destino" options={state.goals.map((g) => ({ label: `${g.emoji} ${g.name}`, value: g.id }))} value={goal} onChange={setGoal} />
      <ToggleRow title="Activar redondeo" value={state.settings.roundUp} onChange={(v) => exec((s) => L.setRoundUp(s, v, goal), v ? 'Redondeo activado.' : 'Redondeo desactivado.')} />
      <KeyValue k="Ahorrado con redondeos" v={money(saved)} />
      {feedback}
    </Card></Screen>
  );
}

function Budgets() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [cat, setCat] = useState<Category>('Supermercado'); const [limit, setLimit] = useState('');
  const status = L.budgetStatus(state);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Presupuesto de {monthLabel(thisMonth())}</Text>
        {status.length === 0 ? <EmptyState text="Sin presupuestos" /> : status.map((b) => (
          <Stack key={b.category} gap="xs">
            <KeyValue k={b.category} v={`${money(b.used)} / ${money(b.limit)}`} />
            <Progress value={b.pct} tone={b.over ? 'danger' : b.warn ? 'warning' : 'success'} />
          </Stack>
        ))}
      </Card>
      <Card>
        <Text variant="heading">Definir presupuesto</Text>
        <Chips options={CATEGORIES.filter((c) => !['Ingresos', 'Transferencias', 'Ahorro', 'Inversiones'].includes(c)).map((c) => ({ label: c, value: c }))} value={cat} onChange={setCat} />
        <Input label="Límite mensual (0 para quitar)" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
        {feedback}
        <Button title="Guardar" onPress={() => { if (exec((s) => L.setBudget(s, cat, parseAmount(limit) || 0), 'Presupuesto guardado.')) setLimit(''); }} />
      </Card>
    </Screen>
  );
}

function BudgetAlerts() {
  const { state } = useBank();
  const status = L.budgetStatus(state).filter((b) => b.warn);
  const day = new Date().getDate(); const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return (
    <Screen>
      {status.length === 0 ? <Banner kind="success" text="Vas bien: ningún presupuesto superó el 80%." /> : status.map((b) => (
        <Banner key={b.category} kind={b.over ? 'error' : 'info'} text={`${b.category}: ${b.over ? 'superaste' : 'usaste el ' + Math.round(b.pct * 100) + '% de'} tu presupuesto (${money(b.used)} de ${money(b.limit)}).`} />
      ))}
      <Card>
        <Text variant="heading">Proyección a fin de mes</Text>
        {L.budgetStatus(state).map((b) => {
          const projected = (b.used / day) * daysInMonth;
          return <KeyValue key={b.category} k={b.category} v={`${money(projected)} ${projected > b.limit ? '⚠️' : '✅'}`} />;
        })}
      </Card>
    </Screen>
  );
}

function SpendingAnalysis() {
  const { state } = useBank();
  const months = [...new Set(state.transactions.map((t) => t.date.slice(0, 7)))].sort().reverse().slice(0, 6);
  const [month, setMonth] = useState(months[0] ?? thisMonth());
  const data = L.spendingByCategory(state, month);
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <Screen>
      <Chips options={months.map((m) => ({ label: monthLabel(m), value: m }))} value={month} onChange={setMonth} />
      <Card>
        <Text variant="heading">Gastos por categoría · {money(total)}</Text>
        {data.length ? <BarList data={data.map((d) => ({ label: `${d.category} (${Math.round((d.total / total) * 100)}%)`, value: d.total }))} format={(n) => money(n)} /> : <EmptyState text="Sin gastos en este mes" />}
      </Card>
    </Screen>
  );
}

function IncomeVsExpenses() {
  const { state } = useBank();
  const data = L.incomeVsExpenses(state, 6);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Ingresos vs egresos (6 meses)</Text>
        <ColumnChart tones={['success', 'danger']} data={data.map((d) => ({ label: monthLabel(d.month).split(' ')[0], values: [d.income, d.expenses] }))} />
        <Text variant="caption" tone="muted">🟩 Ingresos · 🟥 Egresos</Text>
      </Card>
      <Card>
        {data.map((d) => <KeyValue key={d.month} k={monthLabel(d.month)} v={`Ahorro: ${money(d.income - d.expenses, 'USD', { sign: true })}`} />)}
      </Card>
    </Screen>
  );
}

function FixedDeposit() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary()); const [amount, setAmount] = useState('1000'); const [days, setDays] = useState(90); const [renew, setRenew] = useState(false);
  const r = L.fixedDepositReturn(parseAmount(amount) || 0, L.FD_RATES[days], days);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Constituir plazo fijo</Text>
        <AccountPicker value={acc} onChange={setAcc} />
        <Input label="Monto (mín. 100)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Chips label="Plazo" options={Object.keys(L.FD_RATES).map((d) => ({ label: `${d} días · ${L.FD_RATES[Number(d)]}%`, value: Number(d) }))} value={days} onChange={setDays} />
        <KeyValue k="Intereses" v={money(r.interest)} /><KeyValue k="Total al vencimiento" v={money(r.total)} />
        <ToggleRow title="Renovación automática" value={renew} onChange={setRenew} />
        {feedback}
        <Button title="Constituir" onPress={() => exec((s) => L.createFixedDeposit(s, acc!, parseAmount(amount), days, renew), 'Plazo fijo constituido.')} />
      </Card>
      <Card>
        <Text variant="heading">Mis plazos fijos</Text>
        {state.fixedDeposits.length === 0 ? <EmptyState text="Sin plazos fijos" /> : state.fixedDeposits.map((f) => {
          const end = new Date(f.start); end.setDate(end.getDate() + f.days);
          return <ListItem key={f.id} icon="lock-closed-outline" title={`${money(f.amount)} · ${f.rate}% TNA`} subtitle={`${f.status} · vence ${date(end.toISOString())}`} right={`+${money(L.fixedDepositReturn(f.amount, f.rate, f.days).interest)}`} />;
        })}
      </Card>
    </Screen>
  );
}

function FdSimulator() {
  const [amount, setAmount] = useState('10000'); const [rate, setRate] = useState('5.5'); const [days, setDays] = useState('180');
  const r = L.fixedDepositReturn(parseAmount(amount) || 0, parseAmount(rate) || 0, Math.max(1, parseAmount(days) || 1));
  return (
    <Screen><Card>
      <Text variant="heading">Simulador de plazo fijo</Text>
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Input label="TNA %" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
      <Input label="Días" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <KeyValue k="Intereses" v={money(r.interest)} /><KeyValue k="Total" v={money(r.total)} /><KeyValue k="TEA (renovando)" v={`${r.tea}%`} />
    </Card></Screen>
  );
}

function RecurringExpenses() {
  const { state } = useBank();
  const list = L.detectRecurring(state);
  const total = list.reduce((a, r) => a + r.average, 0);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Gastos recurrentes detectados</Text>
        <Text tone="muted" variant="bodySmall">Analizamos tus movimientos para detectar suscripciones y pagos fijos. Total mensual estimado: {money(total)} ({money(total * 12)} al año).</Text>
        {list.length === 0 ? <EmptyState text="No detectamos gastos recurrentes" /> : list.map((r) => <ListItem key={r.description} icon="repeat-outline" title={r.description} subtitle={`${r.count} meses · último ${date(r.last)}`} right={money(r.average)} />)}
      </Card>
    </Screen>
  );
}

/* -------------------------------- Préstamos ------------------------------ */
function LoanSimulator({ kind = 'personal' as Loan['kind'] }) {
  const [amount, setAmount] = useState(kind === 'hipotecario' ? '120000' : '10000'); const [months, setMonths] = useState(kind === 'hipotecario' ? 240 : 24);
  const [k, setK] = useState<Loan['kind']>(kind);
  const sim = L.loanSimulation(parseAmount(amount) || 0, L.LOAN_RATES[k], months);
  const opts = k === 'hipotecario' ? [120, 180, 240, 300, 360] : [6, 12, 24, 36, 48, 60];
  return (
    <Card>
      <Text variant="heading">{kind === 'hipotecario' ? 'Simulador hipotecario' : 'Simulador de préstamo'}</Text>
      {kind !== 'hipotecario' ? <Chips label="Tipo" options={[{ label: 'Personal', value: 'personal' as const }, { label: 'Auto', value: 'auto' as const }]} value={k} onChange={(v) => { setK(v); }} /> : null}
      <Input label={kind === 'hipotecario' ? 'Valor a financiar' : 'Monto'} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Chips label="Plazo (meses)" options={opts.map((m) => ({ label: `${m}`, value: m }))} value={months} onChange={setMonths} />
      <KeyValue k="Tasa (TNA)" v={`${L.LOAN_RATES[k]}%`} />
      <KeyValue k="Cuota mensual" v={money(sim.quota)} />
      <KeyValue k="Total a pagar" v={money(sim.total)} />
      <KeyValue k="Intereses" v={money(sim.interest)} />
      {kind === 'hipotecario' ? <Text variant="caption" tone="muted">Ingreso mínimo sugerido: {money(sim.quota / 0.3)} (cuota ≤ 30% del ingreso).</Text> : null}
    </Card>
  );
}

function RequestLoan() {
  const { exec, feedback } = useAction();
  const [kind, setKind] = useState<Loan['kind']>('personal'); const [amount, setAmount] = useState('5000'); const [months, setMonths] = useState(24); const [acc, setAcc] = useState(usePrimary());
  const sim = L.loanSimulation(parseAmount(amount) || 0, L.LOAN_RATES[kind], months);
  return (
    <Screen><Card>
      <Text variant="heading">Solicitar préstamo</Text>
      <Chips label="Tipo" options={[{ label: 'Personal', value: 'personal' as const }, { label: 'Auto', value: 'auto' as const }, { label: 'Hipotecario', value: 'hipotecario' as const }]} value={kind} onChange={setKind} />
      <Input label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Chips label="Meses" options={[12, 24, 36, 48, 60].map((m) => ({ label: `${m}`, value: m }))} value={months} onChange={setMonths} />
      <AccountPicker label="Acreditar en" value={acc} onChange={setAcc} currency="USD" />
      <Banner kind="info" text={`Cuota estimada ${money(sim.quota)} · TNA ${L.LOAN_RATES[kind]}%. Evaluamos al instante (cuota ≤ 40% de tus ingresos).`} />
      {feedback}
      <ConfirmButton title="Solicitar y acreditar" confirmText="Confirmar solicitud" onConfirm={() => exec((s) => L.requestLoan(s, kind, parseAmount(amount), months, acc!), '¡Préstamo aprobado y acreditado!')} />
    </Card></Screen>
  );
}

function MyLoans({ action }: { action?: 'pay' | 'prepay' | 'schedule' }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(usePrimary());
  const loans = state.loans.filter((l) => action ? l.status === 'activo' : true);
  return (
    <Screen>
      {action && action !== 'schedule' ? <AccountPicker label="Pagar desde" value={acc} onChange={setAcc} /> : null}
      {feedback}
      {loans.length === 0 ? <EmptyState text="No tenés préstamos activos" /> : loans.map((l) => {
        const sim = L.loanSimulation(l.principal, l.rate, l.months);
        return (
          <Card key={l.id}>
            <Text variant="heading">Préstamo {l.kind} · {money(l.principal)}</Text>
            <Progress value={l.paidInstallments / l.months} />
            <KeyValue k="Estado" v={l.status} />
            <KeyValue k="Cuotas pagadas" v={`${l.paidInstallments} / ${l.months}`} />
            <KeyValue k="Cuota" v={money(l.installment)} />
            <KeyValue k="Saldo de capital" v={money(l.outstanding)} />
            {action === 'pay' ? <Button title={`Pagar cuota ${l.paidInstallments + 1}`} onPress={() => exec((s) => L.payLoanInstallment(s, l.id, acc!), 'Cuota pagada.')} /> : null}
            {action === 'prepay' ? (
              <>
                <KeyValue k="Comisión precancelación (2%)" v={money(l.outstanding * L.PREPAYMENT_FEE)} />
                <KeyValue k="Ahorro en intereses" v={money(sim.schedule.slice(l.paidInstallments).reduce((a, r) => a + r.interest, 0))} />
                <ConfirmButton title={`Precancelar ${money(l.outstanding * (1 + L.PREPAYMENT_FEE))}`} onConfirm={() => exec((s) => L.prepayLoan(s, l.id, acc!), 'Préstamo cancelado.')} />
              </>
            ) : null}
            {action === 'schedule' ? (
              <Stack gap="xxs">
                <Text variant="caption" weight="bold">N° · Cuota · Interés · Capital · Saldo</Text>
                {sim.schedule.map((r) => <Text key={r.n} variant="caption" tone={r.n <= l.paidInstallments ? 'muted' : 'default'}>{r.n} · {r.quota.toFixed(2)} · {r.interest.toFixed(2)} · {r.capital.toFixed(2)} · {r.balance.toFixed(2)}{r.n <= l.paidInstallments ? ' ✓' : ''}</Text>)}
              </Stack>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

export const savingsFeatures: Feature[] = [
  { id: 'savings-goals', module: 'ahorro', title: 'Metas de ahorro', description: 'Creá y seguí tus objetivos', icon: 'flag-outline', Component: Goals },
  { id: 'goal-contribute', module: 'ahorro', title: 'Aportar a una meta', description: 'Sumá dinero a tus metas', icon: 'add-circle-outline', Component: () => <GoalActions mode="contribute" /> },
  { id: 'goal-withdraw', module: 'ahorro', title: 'Retirar de una meta', description: 'Recuperá tu dinero', icon: 'remove-circle-outline', Component: () => <GoalActions mode="withdraw" /> },
  { id: 'round-up', module: 'ahorro', title: 'Redondeo automático', description: 'Ahorrá con cada compra', icon: 'sync-circle-outline', Component: RoundUp },
  { id: 'budgets', module: 'ahorro', title: 'Presupuesto mensual', description: 'Límites por categoría', icon: 'pie-chart-outline', Component: Budgets },
  { id: 'budget-alerts', module: 'ahorro', title: 'Alertas de presupuesto', description: 'Avisos al 80% y 100%', icon: 'warning-outline', Component: BudgetAlerts },
  { id: 'spending-analysis', module: 'ahorro', title: 'Análisis de gastos', description: 'Gráfico por categoría', icon: 'bar-chart-outline', Component: SpendingAnalysis },
  { id: 'income-vs-expenses', module: 'ahorro', title: 'Ingresos vs egresos', description: 'Evolución de 6 meses', icon: 'analytics-outline', Component: IncomeVsExpenses },
  { id: 'fixed-deposit', module: 'ahorro', title: 'Plazo fijo', description: 'Hacé crecer tus ahorros', icon: 'lock-closed-outline', Component: FixedDeposit },
  { id: 'fd-simulator', module: 'ahorro', title: 'Simulador de plazo fijo', description: 'Calculá intereses y TEA', icon: 'calculator-outline', Component: FdSimulator },
  { id: 'recurring-expenses', module: 'ahorro', title: 'Gastos recurrentes', description: 'Detectá suscripciones', icon: 'repeat-outline', Component: RecurringExpenses },

  { id: 'loan-simulator', module: 'prestamos', title: 'Simulador de préstamo', description: 'Sistema francés', icon: 'calculator-outline', Component: () => <Screen><LoanSimulator /></Screen> },
  { id: 'loan-request', module: 'prestamos', title: 'Solicitar préstamo', description: 'Aprobación inmediata', icon: 'cash-outline', Component: RequestLoan },
  { id: 'my-loans', module: 'prestamos', title: 'Mis préstamos', description: 'Estado y saldo', icon: 'folder-open-outline', Component: () => <MyLoans /> },
  { id: 'loan-pay', module: 'prestamos', title: 'Pagar cuota', description: 'Pagá tu cuota del mes', icon: 'checkmark-circle-outline', Component: () => <MyLoans action="pay" /> },
  { id: 'amortization', module: 'prestamos', title: 'Tabla de amortización', description: 'Cuota por cuota', icon: 'grid-outline', Component: () => <MyLoans action="schedule" /> },
  { id: 'loan-prepay', module: 'prestamos', title: 'Precancelación', description: 'Cancelá antes y ahorrá intereses', icon: 'flash-outline', Component: () => <MyLoans action="prepay" /> },
  { id: 'mortgage-simulator', module: 'prestamos', title: 'Simulador hipotecario', description: 'Hasta 30 años', icon: 'home-outline', Component: () => <Screen><LoanSimulator kind="hipotecario" /></Screen> },
];
