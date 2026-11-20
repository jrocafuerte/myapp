/**
 * Lógica de negocio pura: cada operación recibe el estado y devuelve un estado nuevo
 * o lanza BankError con un mensaje legible. Así es fácil de testear y de mover a un backend.
 */
import type {
  Account, AppNotification, BankState, Card, Category, Currency, Insurance, Loan, Service, Transaction, TxType,
} from './types';
import { DEFAULT_MESSAGES, formatMessage, type MessageCode, type MessageParams } from '../remote-config/messages';

/**
 * Error de negocio con un CÓDIGO estable. `message` es el texto por defecto;
 * la app muestra el texto de la configuración remota si existe (ver src/remote-config).
 */
export class BankError extends Error {
  constructor(readonly code: MessageCode, readonly params: MessageParams = {}) {
    super(formatMessage(DEFAULT_MESSAGES[code], params));
  }
}

export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const mut = (s: BankState, fn: (d: BankState) => void): BankState => {
  const d = clone(s);
  fn(d);
  return d;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
function assert(cond: unknown, code: MessageCode, params?: MessageParams): asserts cond {
  if (!cond) throw new BankError(code, params);
}
const positive = (amount: number) => assert(Number.isFinite(amount) && amount > 0, 'ingresa_monto_mayor_cero');
const todayKey = () => new Date().toISOString().slice(0, 10);

/* ----------------------------- Tipos de cambio ---------------------------- */
// Valor de 1 unidad de cada moneda expresado en USD.
export const RATES: Record<Currency, number> = { USD: 1, EUR: 1.08, GBP: 1.27 };
export const FX_SPREAD = 0.015;
export const convert = (amount: number, from: Currency, to: Currency) => round2((amount * RATES[from]) / RATES[to]);
export const fxQuote = (from: Currency, to: Currency) => {
  const mid = RATES[from] / RATES[to];
  return { mid, rate: from === to ? 1 : mid * (1 - FX_SPREAD) };
};

/* -------------------------------- Helpers -------------------------------- */
export function autoCategory(description: string): Category {
  const d = description.toLowerCase();
  const rules: [RegExp, Category][] = [
    [/super|mercado|almac/, 'Supermercado'], [/caf|resto|restaurante|pizza|burger|bar /, 'Restaurantes'],
    [/uber|taxi|gasol|metro|bus|transporte|peaje/, 'Transporte'], [/luz|agua|gas|internet|telef|celular|recarga/, 'Servicios'],
    [/farmac|clinic|médic|medic|salud/, 'Salud'], [/cine|teatro|juego|concierto/, 'Entretenimiento'],
    [/netflix|spotify|disney|gimnasio|suscrip/, 'Suscripciones'], [/libr|curso|universidad|colegio/, 'Educación'],
    [/alquiler|expensas|hipoteca/, 'Vivienda'], [/impuesto|tasa|municipal/, 'Impuestos'], [/nómina|nomina|sueldo|salario/, 'Ingresos'],
    [/tienda|shop|compra|amazon/, 'Compras'], [/transfer/, 'Transferencias'],
  ];
  return rules.find(([re]) => re.test(d))?.[1] ?? 'Otros';
}

export const getAccount = (s: BankState, id: string): Account => {
  const a = s.accounts.find((x) => x.id === id);
  assert(a, 'cuenta_no_existe');
  assert(!a.closed, 'cuenta_esta_cerrada');
  return a;
};
const getCard = (s: BankState, id: string): Card => {
  const c = s.cards.find((x) => x.id === id);
  assert(c, 'tarjeta_no_existe');
  return c;
};
const notify = (d: BankState, kind: AppNotification['kind'], title: string, body: string) => {
  d.notifications.unshift({ id: uid('n'), kind, title, body, date: new Date().toISOString(), read: false });
};

function addTx(d: BankState, accountId: string, amount: number, description: string, type: TxType,
  extra: Partial<Transaction> = {}): Transaction {
  const tx: Transaction = {
    id: uid('tx'), accountId, amount: round2(amount), description, type, date: new Date().toISOString(),
    category: extra.category ?? autoCategory(description), reference: `REF${Math.floor(100000 + Math.random() * 899999)}`,
    ...extra,
  };
  d.transactions.unshift(tx);
  const acc = d.accounts.find((a) => a.id === accountId)!;
  if (Math.abs(amount) >= d.settings.largeTxThreshold) {
    notify(d, 'movimiento', 'Movimiento importante', `${description}: ${amount > 0 ? '+' : ''}${amount.toFixed(2)} ${acc.currency}`);
  }
  if (amount < 0 && acc.balance < d.settings.lowBalanceThreshold) {
    notify(d, 'movimiento', 'Saldo bajo', `${acc.alias} quedó con ${acc.balance.toFixed(2)} ${acc.currency}.`);
  }
  return tx;
}

function debit(d: BankState, accountId: string, amount: number, description: string, type: TxType, extra: Partial<Transaction> = {}) {
  positive(amount);
  assert(!d.user.emergencyLocked, 'cuenta_esta_bloqueada_emergencia');
  const acc = getAccount(d, accountId);
  assert(acc.balance >= amount, 'saldo_insuficiente', { alias: acc.alias });
  acc.balance = round2(acc.balance - amount);
  const tx = addTx(d, accountId, -amount, description, type, extra);
  // Redondeo automático hacia una meta de ahorro
  if (d.settings.roundUp && d.settings.roundUpGoalId && (type === 'card' || type === 'payment')) {
    const diff = round2(Math.ceil(amount) - amount);
    const goal = d.goals.find((g) => g.id === d.settings.roundUpGoalId);
    if (diff > 0 && goal && acc.balance >= diff) {
      acc.balance = round2(acc.balance - diff);
      goal.saved = round2(goal.saved + diff);
      addTx(d, accountId, -diff, `Redondeo a meta "${goal.name}"`, 'savings', { category: 'Ahorro' });
    }
  }
  return tx;
}

function credit(d: BankState, accountId: string, amount: number, description: string, type: TxType, extra: Partial<Transaction> = {}) {
  positive(amount);
  const acc = getAccount(d, accountId);
  acc.balance = round2(acc.balance + amount);
  return addTx(d, accountId, amount, description, type, extra);
}

function checkTransferLimits(d: BankState, amountUsd: number) {
  if (d.transferredToday.date !== todayKey()) d.transferredToday = { date: todayKey(), amount: 0 };
  assert(amountUsd <= d.settings.perTransferLimit, 'supera_limite_operacion_usd', { limit: d.settings.perTransferLimit });
  assert(d.transferredToday.amount + amountUsd <= d.settings.dailyTransferLimit, 'supera_limite_diario_usd', { limit: d.settings.dailyTransferLimit, available: round2(d.settings.dailyTransferLimit - d.transferredToday.amount) });
  d.transferredToday.amount = round2(d.transferredToday.amount + amountUsd);
}

/* ------------------------------ Seguridad -------------------------------- */
export const login = (s: BankState, username: string, password: string, device = 'Este dispositivo') => {
  const ok = username.trim().toLowerCase() === s.user.username && password === s.user.password;
  const next = mut(s, (d) => {
    d.loginHistory.unshift({ id: uid('l'), date: new Date().toISOString(), device, method: 'contraseña', success: ok });
    if (!ok) notify(d, 'seguridad', 'Intento de acceso fallido', `Contraseña incorrecta desde ${device}.`);
  });
  return { ok, state: next };
};
export const recordLogin = (s: BankState, method: 'biometría' | 'PIN') =>
  mut(s, (d) => { d.loginHistory.unshift({ id: uid('l'), date: new Date().toISOString(), device: 'Este dispositivo', method, success: true }); });

export const changePassword = (s: BankState, current: string, next: string, confirm: string) => mut(s, (d) => {
  assert(current === d.user.password, 'contrasena_actual_incorrecta');
  assert(next.length >= 8, 'nueva_contrasena_debe_tener');
  assert(/\d/.test(next) && /[a-zA-Z]/.test(next), 'debe_combinar_letras_numeros');
  assert(next === confirm, 'contrasenas_no_coinciden');
  assert(next !== current, 'nueva_contrasena_debe_ser');
  d.user.password = next;
  notify(d, 'seguridad', 'Contraseña actualizada', 'Tu contraseña se cambió correctamente.');
});

export const setPin = (s: BankState, pin: string, confirm: string) => mut(s, (d) => {
  assert(/^\d{4,6}$/.test(pin), 'pin_debe_tener_entre');
  assert(!/^(\d)\1+$/.test(pin) && !'0123456789'.includes(pin), 'elegi_pin_menos_predecible');
  assert(pin === confirm, 'pin_no_coinciden');
  d.settings.pin = pin;
});

export const setSecurityQuestions = (s: BankState, qs: { question: string; answer: string }[]) => mut(s, (d) => {
  assert(qs.length >= 2 && qs.every((q) => q.question && q.answer.trim().length >= 2), 'completa_minimo_dos_preguntas');
  d.settings.securityQuestions = qs.map((q) => ({ question: q.question, answer: q.answer.trim().toLowerCase() }));
});

export const revokeDevice = (s: BankState, id: string) => mut(s, (d) => {
  const dev = d.devices.find((x) => x.id === id);
  assert(dev, 'dispositivo_no_encontrado');
  assert(!dev.current, 'no_podes_desvincular_dispositivo');
  d.devices = d.devices.filter((x) => x.id !== id);
  notify(d, 'seguridad', 'Dispositivo desvinculado', `${dev.name} ya no tiene acceso.`);
});

export const setEmergencyLock = (s: BankState, locked: boolean, password?: string) => mut(s, (d) => {
  if (!locked) assert(password === d.user.password, 'contrasena_incorrecta');
  d.user.emergencyLocked = locked;
  d.cards.forEach((c) => { if (c.status !== 'cancelada') c.status = locked ? 'bloqueada' : 'activa'; });
  notify(d, 'seguridad', locked ? 'Bloqueo de emergencia activado' : 'Bloqueo de emergencia desactivado',
    locked ? 'Todas tus tarjetas y operaciones salientes fueron bloqueadas.' : 'Tus tarjetas volvieron a estar activas.');
});

/** Token OTP de 6 dígitos que cambia cada 30 s (simulación tipo TOTP). */
export function otpCode(seed: string, t = Date.now()) {
  const step = Math.floor(t / 30000);
  let h = 2166136261;
  for (const ch of `${seed}:${step}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000000).toString().padStart(6, '0');
}

/* -------------------------------- Cuentas -------------------------------- */
export const openAccount = (s: BankState, type: Account['type'], currency: Currency, alias: string) => mut(s, (d) => {
  assert(alias.trim().length >= 3, 'alias_debe_tener_minimo');
  assert(d.accounts.filter((a) => !a.closed).length < 8, 'alcanzaste_maximo_8_cuentas');
  const n = Math.floor(1000 + Math.random() * 8999);
  d.accounts.push({
    id: uid('acc'), alias: alias.trim(), type, currency, balance: 0, number: `0012-${n}-${Math.floor(1000 + Math.random() * 8999)}`,
    interbankCode: `0120012${n}${Date.now().toString().slice(-9)}`, isPrimary: false, closed: false, createdAt: new Date().toISOString(),
  });
  notify(d, 'sistema', 'Cuenta abierta', `Tu cuenta "${alias.trim()}" en ${currency} ya está disponible.`);
});
export const renameAccount = (s: BankState, id: string, alias: string) => mut(s, (d) => {
  assert(alias.trim().length >= 3 && alias.trim().length <= 24, 'alias_debe_tener_entre');
  getAccount(d, id).alias = alias.trim();
});
export const setPrimaryAccount = (s: BankState, id: string) => mut(s, (d) => {
  getAccount(d, id);
  d.accounts.forEach((a) => { a.isPrimary = a.id === id; });
});
export const closeAccount = (s: BankState, id: string) => mut(s, (d) => {
  const a = getAccount(d, id);
  assert(!a.isPrimary, 'no_podes_cerrar_cuenta');
  assert(a.balance === 0, 'cuenta_debe_tener_saldo');
  assert(!d.cards.some((c) => c.accountId === id && c.status !== 'cancelada'), 'hay_tarjetas_asociadas_activas');
  a.closed = true;
});
export const totalBalance = (s: BankState, currency: Currency) =>
  round2(s.accounts.filter((a) => !a.closed).reduce((t, a) => t + convert(a.balance, a.currency, currency), 0));

/* ------------------------------ Movimientos ------------------------------ */
export const setTxCategory = (s: BankState, id: string, category: Category) => mut(s, (d) => {
  const t = d.transactions.find((x) => x.id === id);
  assert(t, 'movimiento_no_encontrado');
  t.category = category;
});
export const setTxNote = (s: BankState, id: string, note: string) => mut(s, (d) => {
  const t = d.transactions.find((x) => x.id === id);
  assert(t, 'movimiento_no_encontrado');
  t.note = note.trim().slice(0, 140) || undefined;
});
export function filterTx(s: BankState, f: { q?: string; kind?: 'todos' | 'ingresos' | 'egresos'; accountId?: string; category?: Category; month?: string }) {
  const q = f.q?.trim().toLowerCase();
  return s.transactions.filter((t) =>
    (!q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q) || t.reference.toLowerCase().includes(q))
    && (!f.kind || f.kind === 'todos' || (f.kind === 'ingresos' ? t.amount > 0 : t.amount < 0))
    && (!f.accountId || t.accountId === f.accountId)
    && (!f.category || t.category === f.category)
    && (!f.month || t.date.startsWith(f.month)));
}
export function toCsv(s: BankState, txs: Transaction[]) {
  const acc = (id: string) => s.accounts.find((a) => a.id === id);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = txs.map((t) => [t.date.slice(0, 10), esc(t.description), t.category, t.amount.toFixed(2), acc(t.accountId)?.currency ?? '', esc(acc(t.accountId)?.alias ?? ''), t.reference].join(','));
  return ['Fecha,Descripción,Categoría,Monto,Moneda,Cuenta,Referencia', ...rows].join('\n');
}
export function monthlyStatement(s: BankState, accountId: string, month: string) {
  const txs = s.transactions.filter((t) => t.accountId === accountId && t.date.startsWith(month));
  const income = round2(txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0));
  const expenses = round2(-txs.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0));
  const acc = s.accounts.find((a) => a.id === accountId)!;
  const later = round2(s.transactions.filter((t) => t.accountId === accountId && t.date.slice(0, 7) > month).reduce((a, t) => a + t.amount, 0));
  const closing = round2(acc.balance - later);
  return { txs, income, expenses, closing, opening: round2(closing - income + expenses) };
}
export function spendingByCategory(s: BankState, month: string) {
  const map = new Map<Category, number>();
  s.transactions.filter((t) => t.amount < 0 && t.date.startsWith(month) && !['Ahorro', 'Inversiones', 'Transferencias'].includes(t.category))
    .forEach((t) => {
      const acc = s.accounts.find((a) => a.id === t.accountId);
      map.set(t.category, round2((map.get(t.category) ?? 0) + convert(-t.amount, acc?.currency ?? 'USD', 'USD')));
    });
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}
export function incomeVsExpenses(s: BankState, months = 6) {
  const out: { month: string; income: number; expenses: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7);
    const txs = s.transactions.filter((t) => t.date.startsWith(m) && t.type !== 'savings');
    out.push({ month: m, income: round2(txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0)),
      expenses: round2(-txs.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0)) });
  }
  return out;
}
export function detectRecurring(s: BankState) {
  const groups = new Map<string, Transaction[]>();
  s.transactions.filter((t) => t.amount < 0).forEach((t) => {
    const k = t.description.toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), t]);
  });
  return [...groups.values()].filter((g) => {
    if (g.length < 2) return false;
    const months = new Set(g.map((t) => t.date.slice(0, 7)));
    const amounts = g.map((t) => -t.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    return months.size >= 2 && amounts.every((a) => Math.abs(a - avg) / avg < 0.25) && months.size === g.length;
  }).map((g) => ({ description: g[0].description, average: round2(-g.reduce((a, t) => a + t.amount, 0) / g.length), count: g.length, last: g[0].date }))
    .sort((a, b) => b.average - a.average);
}

/* ----------------------------- Transferencias ---------------------------- */
export const transferOwn = (s: BankState, fromId: string, toId: string, amount: number, concept = '') => mut(s, (d) => {
  assert(fromId !== toId, 'elegi_cuentas_distintas');
  const from = getAccount(d, fromId); const to = getAccount(d, toId);
  const { rate } = fxQuote(from.currency, to.currency);
  const received = round2(amount * rate);
  debit(d, fromId, amount, `Transferencia a ${to.alias}${concept ? ` · ${concept}` : ''}`, from.currency === to.currency ? 'transfer' : 'fx', { category: 'Transferencias' });
  credit(d, toId, received, `Transferencia desde ${from.alias}${concept ? ` · ${concept}` : ''}`, from.currency === to.currency ? 'transfer' : 'fx', { category: 'Transferencias' });
});

export const transferToBeneficiary = (s: BankState, fromId: string, beneficiaryId: string, amount: number, concept = '') => mut(s, (d) => {
  const b = d.beneficiaries.find((x) => x.id === beneficiaryId);
  assert(b, 'beneficiario_no_encontrado');
  const from = getAccount(d, fromId);
  checkTransferLimits(d, convert(amount, from.currency, 'USD'));
  debit(d, fromId, amount, `Transferencia a ${b.name}${concept ? ` · ${concept}` : ''}`, 'transfer', { counterpart: b.name, category: 'Transferencias' });
  const internal = b.bank === 'Banco Plus';
  notify(d, 'movimiento', 'Transferencia enviada', `${amount.toFixed(2)} ${from.currency} a ${b.name}${internal ? ' (inmediata)' : ''}.`);
});

export const findByAliasOrNumber = (s: BankState, key: string) => {
  const k = key.trim().toLowerCase();
  return s.beneficiaries.find((b) => b.alias.toLowerCase() === k || b.accountNumber.replace(/-/g, '') === k.replace(/-/g, ''));
};

export const transferByAlias = (s: BankState, fromId: string, key: string, name: string, amount: number, concept = '', save = false) => {
  const k = key.trim();
  assert(/^[a-zA-Z0-9.\-]{6,30}$/.test(k), 'alias_numero_cuenta_invalido');
  let state = s;
  let ben = findByAliasOrNumber(state, k);
  if (!ben) {
    assert(name.trim().length >= 3, 'indica_nombre_titular');
    state = addBeneficiary(state, { name, bank: 'Otro banco', accountNumber: /\d/.test(k) && !k.includes('.') ? k : '-', alias: k.includes('.') ? k : '', currency: 'USD' });
    ben = state.beneficiaries[state.beneficiaries.length - 1];
  }
  state = transferToBeneficiary(state, fromId, ben.id, amount, concept);
  if (!save && !findByAliasOrNumber(s, k)) state = mut(state, (d) => { d.beneficiaries = d.beneficiaries.filter((b) => b.id !== ben!.id); });
  return state;
};

export const INTL_FEE_USD = 15;
export const transferInternational = (s: BankState, fromId: string, p: { name: string; iban: string; swift: string; country: string; currency: Currency; amount: number; concept: string }) => mut(s, (d) => {
  assert(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(p.swift.toUpperCase()), 'codigo_swift_bic_invalido');
  assert(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(p.iban.replace(/\s/g, '').toUpperCase()), 'iban_invalido');
  assert(p.name.trim().length >= 3, 'indica_nombre_beneficiario');
  assert(p.concept.trim().length >= 3, 'motivo_obligatorio_transferencias_internacionales');
  positive(p.amount);
  const from = getAccount(d, fromId);
  const { rate } = fxQuote(from.currency, p.currency);
  const cost = round2(p.amount / rate);
  const fee = convert(INTL_FEE_USD, 'USD', from.currency);
  checkTransferLimits(d, convert(cost, from.currency, 'USD'));
  debit(d, fromId, cost, `SWIFT a ${p.name} (${p.amount} ${p.currency}) · ${p.country}`, 'transfer', { counterpart: p.name, category: 'Transferencias' });
  debit(d, fromId, fee, 'Comisión transferencia internacional', 'fee', { category: 'Comisiones' });
});

export const addBeneficiary = (s: BankState, b: { name: string; bank: string; accountNumber: string; alias: string; currency: Currency }) => mut(s, (d) => {
  assert(b.name.trim().length >= 3, 'nombre_debe_tener_minimo');
  assert(b.accountNumber.trim() || b.alias.trim(), 'ingresa_numero_cuenta_alias');
  if (b.accountNumber.trim() && b.accountNumber !== '-') assert(/^[\d-]{8,24}$/.test(b.accountNumber.trim()), 'numero_cuenta_invalido');
  assert(!d.beneficiaries.some((x) => (b.alias && x.alias === b.alias.trim()) || (b.accountNumber !== '-' && x.accountNumber === b.accountNumber.trim())), 'ese_beneficiario_ya_esta');
  d.beneficiaries.push({ id: uid('ben'), name: b.name.trim(), bank: b.bank.trim() || 'Otro banco', accountNumber: b.accountNumber.trim(), alias: b.alias.trim(), currency: b.currency, favorite: false });
});
export const removeBeneficiary = (s: BankState, id: string) => mut(s, (d) => {
  assert(!d.scheduled.some((x) => x.beneficiaryId === id && x.active), 'tiene_transferencias_programadas_activas');
  d.beneficiaries = d.beneficiaries.filter((b) => b.id !== id);
});
export const toggleFavorite = (s: BankState, id: string) => mut(s, (d) => {
  const b = d.beneficiaries.find((x) => x.id === id); assert(b, 'beneficiario_no_encontrado'); b.favorite = !b.favorite;
});
export const scheduleTransfer = (s: BankState, p: { fromId: string; beneficiaryId: string; amount: number; date: string; frequency: 'unica' | 'semanal' | 'mensual'; concept: string }) => mut(s, (d) => {
  positive(p.amount);
  getAccount(d, p.fromId);
  assert(d.beneficiaries.some((b) => b.id === p.beneficiaryId), 'elegi_beneficiario');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date > todayKey(), 'fecha_debe_ser_futura');
  d.scheduled.push({ id: uid('sch'), fromId: p.fromId, beneficiaryId: p.beneficiaryId, amount: p.amount, nextDate: p.date, frequency: p.frequency, concept: p.concept || 'Programada', active: true });
});
export const cancelScheduled = (s: BankState, id: string) => mut(s, (d) => {
  const x = d.scheduled.find((t) => t.id === id); assert(x, 'transferencia_no_encontrada'); x.active = false;
});
/** Ejecuta las programadas vencidas (se llama al abrir la app). */
export function runScheduled(s: BankState): BankState {
  let state = s;
  for (const sch of s.scheduled.filter((x) => x.active && x.nextDate <= todayKey())) {
    try {
      state = transferToBeneficiary(state, sch.fromId, sch.beneficiaryId, sch.amount, sch.concept);
      state = mut(state, (d) => {
        const x = d.scheduled.find((t) => t.id === sch.id)!;
        if (x.frequency === 'unica') x.active = false;
        else {
          const nd = new Date(`${x.nextDate}T12:00:00`);
          if (x.frequency === 'semanal') nd.setDate(nd.getDate() + 7); else nd.setMonth(nd.getMonth() + 1);
          x.nextDate = nd.toISOString().slice(0, 10);
        }
      });
    } catch (e) {
      state = mut(state, (d) => notify(d, 'pago', 'Transferencia programada fallida', `${sch.concept}: ${(e as Error).message}`));
    }
  }
  return state;
}
export const setTransferLimits = (s: BankState, perTransfer: number, daily: number) => mut(s, (d) => {
  positive(perTransfer); positive(daily);
  assert(perTransfer <= daily, 'limite_operacion_no_puede');
  assert(daily <= 50000, 'limite_diario_maximo_50');
  d.settings.perTransferLimit = perTransfer; d.settings.dailyTransferLimit = daily;
  notify(d, 'seguridad', 'Límites actualizados', `Por operación: ${perTransfer} USD · Diario: ${daily} USD.`);
});

export const requestMoney = (s: BankState, counterpart: string, amount: number, concept: string) => mut(s, (d) => {
  positive(amount); assert(counterpart.trim().length >= 3, 'indica_quien_le_pedis');
  d.requests.unshift({ id: uid('req'), direction: 'enviada', counterpart: counterpart.trim(), amount, concept: concept.trim() || 'Solicitud', date: new Date().toISOString(), status: 'pendiente' });
});
export const answerRequest = (s: BankState, id: string, accept: boolean, fromId: string) => {
  const r = s.requests.find((x) => x.id === id);
  assert(r && r.direction === 'recibida' && r.status === 'pendiente', 'solicitud_no_disponible');
  let state = s;
  if (accept) state = mut(state, (d) => debit(d, fromId, r.amount, `Pago a ${r.counterpart} · ${r.concept}`, 'transfer', { counterpart: r.counterpart, category: 'Transferencias' }));
  return mut(state, (d) => { d.requests.find((x) => x.id === id)!.status = accept ? 'pagada' : 'rechazada'; });
};
export const createSplit = (s: BankState, concept: string, total: number, names: string[], includeMe = true) => mut(s, (d) => {
  positive(total);
  const people = names.map((n) => n.trim()).filter(Boolean);
  assert(people.length >= 1, 'agrega_minimo_persona');
  const count = people.length + (includeMe ? 1 : 0);
  const share = round2(total / count);
  d.splits.unshift({ id: uid('spl'), concept: concept.trim() || 'Gasto compartido', total, date: new Date().toISOString(), participants: people.map((name) => ({ name, share, paid: false })) });
  people.forEach((name) => d.requests.unshift({ id: uid('req'), direction: 'enviada', counterpart: name, amount: share, concept: concept || 'Gasto compartido', date: new Date().toISOString(), status: 'pendiente' }));
});
export const markSplitPaid = (s: BankState, splitId: string, name: string, accountId: string) => mut(s, (d) => {
  const sp = d.splits.find((x) => x.id === splitId); assert(sp, 'gasto_no_encontrado');
  const p = sp.participants.find((x) => x.name === name); assert(p && !p.paid, 'ya_figura_como_pagado');
  p.paid = true; credit(d, accountId, p.share, `${name} pagó su parte · ${sp.concept}`, 'transfer', { counterpart: name, category: 'Transferencias' });
});
export const qrPayload = (s: BankState, accountId: string, amount?: number) => {
  const a = getAccount(s, accountId);
  return `BANCOPLUS://pay?to=${a.interbankCode}&name=${encodeURIComponent(s.user.name)}&cur=${a.currency}${amount ? `&amount=${amount.toFixed(2)}` : ''}`;
};
export const payQr = (s: BankState, accountId: string, code: string, amount: number) => mut(s, (d) => {
  const m = /^(?:BANCOPLUS:\/\/pay\?to=(\d+)&name=([^&]+)|COMERCIO-([A-Z0-9]{4,}))/i.exec(code.trim());
  assert(m, 'codigo_qr_invalido_formato');
  const name = m[2] ? decodeURIComponent(m[2]) : `Comercio ${m[3]}`;
  debit(d, accountId, amount, `Pago QR a ${name}`, 'payment', { counterpart: name, category: 'Compras' });
  d.user.points += Math.floor(amount);
});

/* --------------------------------- Pagos --------------------------------- */
export const payService = (s: BankState, serviceId: string, accountId: string, amount?: number) => mut(s, (d) => {
  const srv = d.services.find((x) => x.id === serviceId); assert(srv, 'servicio_no_encontrado');
  const amt = amount ?? srv.amountDue; assert(srv.amountDue > 0 || amount, 'este_servicio_no_tiene');
  debit(d, accountId, amt, `Pago ${srv.type} - ${srv.company}`, 'payment', { category: srv.type === 'Impuestos' ? 'Impuestos' : 'Servicios' });
  srv.amountDue = round2(Math.max(0, srv.amountDue - amt));
  d.user.points += Math.floor(amt / 2);
});
export const addService = (s: BankState, p: { company: string; type: Service['type']; customerNumber: string }) => mut(s, (d) => {
  assert(p.company.trim().length >= 2, 'indica_empresa');
  assert(/^[A-Za-z0-9-]{4,20}$/.test(p.customerNumber.trim()), 'numero_cliente_invalido_4');
  assert(!d.services.some((x) => x.company === p.company.trim() && x.customerNumber === p.customerNumber.trim()), 'ese_servicio_ya_esta');
  const due = new Date(); due.setDate(due.getDate() + 10 + Math.floor(Math.random() * 15));
  d.services.push({ id: uid('srv'), company: p.company.trim(), type: p.type, customerNumber: p.customerNumber.trim(), amountDue: round2(20 + Math.random() * 80), dueDate: due.toISOString().slice(0, 10), autoDebit: false, reminder: true });
});
export const removeService = (s: BankState, id: string) => mut(s, (d) => { d.services = d.services.filter((x) => x.id !== id); });
export const setAutoDebit = (s: BankState, id: string, on: boolean, accountId?: string) => mut(s, (d) => {
  const srv = d.services.find((x) => x.id === id); assert(srv, 'servicio_no_encontrado');
  if (on) { assert(accountId, 'elegi_cuenta_debitar'); getAccount(d, accountId); }
  srv.autoDebit = on; srv.autoDebitAccountId = on ? accountId : undefined;
});
export const setReminder = (s: BankState, id: string, on: boolean) => mut(s, (d) => {
  const srv = d.services.find((x) => x.id === id); assert(srv, 'servicio_no_encontrado'); srv.reminder = on;
});
/** Al abrir la app: paga débitos automáticos vencidos y genera recordatorios. */
export function processBills(s: BankState): BankState {
  let state = s;
  const today = todayKey();
  const in3 = new Date(); in3.setDate(in3.getDate() + 3);
  for (const srv of s.services) {
    if (srv.amountDue <= 0) continue;
    if (srv.autoDebit && srv.autoDebitAccountId && srv.dueDate <= today) {
      try { state = payService(state, srv.id, srv.autoDebitAccountId); } catch (e) {
        state = mut(state, (d) => notify(d, 'pago', 'Débito automático rechazado', `${srv.company}: ${(e as Error).message}`));
      }
    } else if (srv.reminder && srv.dueDate <= in3.toISOString().slice(0, 10)) {
      const title = `Vence ${srv.company}`;
      if (!state.notifications.some((n) => n.title === title && n.date.startsWith(today))) {
        state = mut(state, (d) => notify(d, 'pago', title, `${srv.type}: ${srv.amountDue.toFixed(2)} USD vence el ${srv.dueDate}.`));
      }
    }
  }
  return state;
}
export const TOPUP_OPERATORS = ['Claro', 'Movistar', 'Tigo', 'Digitel'];
export const mobileTopUp = (s: BankState, accountId: string, operator: string, phone: string, amount: number) => mut(s, (d) => {
  assert(TOPUP_OPERATORS.includes(operator), 'elegi_operadora');
  assert(/^\+?\d{8,13}$/.test(phone.replace(/\s/g, '')), 'numero_celular_invalido');
  assert([5, 10, 20, 30, 50].includes(amount), 'montos_disponibles_5_10');
  debit(d, accountId, amount, `Recarga celular ${operator} ${phone}`, 'payment', { category: 'Servicios' });
});
export const transportTopUp = (s: BankState, accountId: string, cardNumber: string, amount: number) => mut(s, (d) => {
  assert(/^\d{10,16}$/.test(cardNumber.replace(/\s/g, '')), 'numero_tarjeta_transporte_invalido');
  assert(amount >= 2 && amount <= 100, 'monto_debe_estar_entre');
  debit(d, accountId, amount, `Recarga transporte ****${cardNumber.slice(-4)}`, 'payment', { category: 'Transporte' });
});
export const TAXES = ['Impuesto predial', 'Impuesto vehicular', 'Impuesto a la renta', 'Tasa municipal'] as const;
export const payTax = (s: BankState, accountId: string, tax: string, taxId: string, amount: number) => mut(s, (d) => {
  assert((TAXES as readonly string[]).includes(tax), 'elegi_impuesto');
  assert(/^[A-Za-z0-9-]{5,20}$/.test(taxId.trim()), 'identificador_tributario_invalido');
  debit(d, accountId, amount, `${tax} · ${taxId.trim()}`, 'payment', { category: 'Impuestos' });
});

/* -------------------------------- Tarjetas ------------------------------- */
export const setCardStatus = (s: BankState, id: string, status: 'activa' | 'bloqueada') => mut(s, (d) => {
  const c = getCard(d, id); assert(c.status !== 'cancelada', 'tarjeta_esta_cancelada');
  if (status === 'activa') assert(!d.user.emergencyLocked, 'desactiva_primero_bloqueo_emergencia');
  c.status = status;
  notify(d, 'seguridad', status === 'bloqueada' ? 'Tarjeta bloqueada' : 'Tarjeta desbloqueada', `${c.brand} ****${c.number.slice(-4)}`);
});
const luhnNumber = (prefix: string) => {
  const digits = (prefix + Array.from({ length: 15 - prefix.length }, () => Math.floor(Math.random() * 10)).join('')).split('').map(Number);
  const sum = digits.reverse().reduce((acc, n, i) => acc + (i % 2 === 0 ? (n * 2 > 9 ? n * 2 - 9 : n * 2) : n), 0);
  return digits.reverse().join('') + ((10 - (sum % 10)) % 10);
};
export const isLuhnValid = (num: string) => {
  const ds = num.replace(/\D/g, '').split('').reverse().map(Number);
  return ds.length >= 12 && ds.reduce((a, n, i) => a + (i % 2 ? (n * 2 > 9 ? n * 2 - 9 : n * 2) : n), 0) % 10 === 0;
};
const newExpiry = (years: number) => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String((d.getFullYear() + years) % 100).padStart(2, '0')}`; };
export const reportCard = (s: BankState, id: string, reason: 'robo' | 'pérdida' | 'daño', reissue: boolean) => mut(s, (d) => {
  const c = getCard(d, id); assert(c.status !== 'cancelada', 'tarjeta_ya_esta_cancelada');
  c.status = 'cancelada';
  if (reissue) {
    d.cards.push({ ...c, id: uid('card'), number: luhnNumber(c.brand === 'Visa' ? '4' : '5'), cvv: String(Math.floor(100 + Math.random() * 900)), expiry: newExpiry(4), status: 'activa' });
  }
  notify(d, 'seguridad', `Tarjeta denunciada por ${reason}`, reissue ? 'Cancelamos la tarjeta y emitimos un reemplazo. Llegará en 5 días hábiles.' : 'La tarjeta fue cancelada definitivamente.');
});
export const createVirtualCard = (s: BankState, accountId: string, limit: number, oneTime: boolean) => mut(s, (d) => {
  getAccount(d, accountId); positive(limit);
  assert(d.cards.filter((c) => c.virtual && c.status !== 'cancelada').length < 5, 'maximo_5_tarjetas_virtuales');
  d.cards.push({ id: uid('card'), kind: 'debito', virtual: true, oneTime, brand: 'Visa', number: luhnNumber('4'), cvv: String(Math.floor(100 + Math.random() * 900)), expiry: newExpiry(oneTime ? 1 : 3), holder: d.user.name.toUpperCase(), accountId, status: 'activa', pin: '0000', limit, used: 0, onlineEnabled: true, abroadEnabled: false, dueDate: new Date().toISOString() });
});
export const changeCardPin = (s: BankState, id: string, current: string, pin: string, confirm: string) => mut(s, (d) => {
  const c = getCard(d, id); assert(!c.virtual, 'tarjetas_virtuales_no_usan');
  assert(current === c.pin, 'pin_actual_incorrecto');
  assert(/^\d{4}$/.test(pin), 'pin_debe_tener_4'); assert(pin === confirm, 'pin_no_coinciden');
  assert(!/^(\d)\1{3}$/.test(pin) && !['1234', '4321'].includes(pin), 'elegi_pin_menos_predecible');
  c.pin = pin;
});
export const setCardLimit = (s: BankState, id: string, limit: number) => mut(s, (d) => {
  const c = getCard(d, id); positive(limit);
  if (c.kind === 'credito') assert(limit <= c.limit, 'credito_solo_podes_reducir');
  else assert(limit <= 20000, 'limite_maximo_gasto_20');
  assert(limit >= c.used || c.kind === 'debito', 'limite_no_puede_ser');
  c.limit = limit;
});
export const setCardFlag = (s: BankState, id: string, flag: 'onlineEnabled' | 'abroadEnabled', on: boolean) => mut(s, (d) => {
  const c = getCard(d, id); assert(c.status === 'activa', 'tarjeta_no_esta_activa'); c[flag] = on;
});
export const setTravelNotice = (s: BankState, id: string, country: string, from: string, to: string) => mut(s, (d) => {
  const c = getCard(d, id);
  assert(country.trim().length >= 3, 'indica_pais_destino');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to, 'fechas_invalidas_aaaa_mm');
  c.travelNotice = { country: country.trim(), from, to }; c.abroadEnabled = true;
  notify(d, 'seguridad', 'Aviso de viaje registrado', `${country} del ${from} al ${to}.`);
});
export const cardPurchase = (s: BankState, id: string, merchant: string, amount: number, online = false) => mut(s, (d) => {
  const c = getCard(d, id); positive(amount);
  assert(c.status === 'activa', 'tarjeta_no_activa');
  if (online) assert(c.onlineEnabled, 'compras_online_deshabilitadas');
  assert(c.used + amount <= c.limit, 'supera_limite_tarjeta');
  if (c.kind === 'credito') { c.used = round2(c.used + amount); }
  else { debit(d, c.accountId, amount, merchant, 'card'); c.used = round2(c.used + amount); }
  if (c.oneTime) c.status = 'cancelada';
  d.user.points += Math.floor(amount);
});
export const creditCardStatement = (c: Card) => ({ balance: c.used, minimum: round2(Math.max(25, c.used * 0.05)), available: round2(c.limit - c.used), dueDate: c.dueDate });
export const payCreditCard = (s: BankState, cardId: string, accountId: string, amount: number) => mut(s, (d) => {
  const c = getCard(d, cardId); assert(c.kind === 'credito', 'solo_tarjetas_credito');
  assert(c.used > 0, 'no_hay_saldo_pagar');
  assert(amount <= c.used + 0.001, 'maximo_pagar', { max: c.used.toFixed(2) });
  debit(d, accountId, amount, `Pago tarjeta ${c.brand} ****${c.number.slice(-4)}`, 'payment', { category: 'Transferencias' });
  c.used = round2(c.used - amount);
});
/** Plan en cuotas con interés (sistema francés). */
export function installmentPlan(amount: number, months: number, tna: number) {
  const i = tna / 100 / 12;
  const quota = i === 0 ? amount / months : (amount * i) / (1 - (1 + i) ** -months);
  return { quota: round2(quota), total: round2(quota * months), interest: round2(quota * months - amount) };
}
export const requestLimitIncrease = (s: BankState, id: string, amount: number) => mut(s, (d) => {
  const c = getCard(d, id); assert(c.kind === 'credito', 'solo_tarjetas_credito');
  assert(amount > c.limit, 'nuevo_limite_debe_ser');
  const income = d.transactions.filter((t) => t.category === 'Ingresos' && t.amount > 0).slice(0, 3).reduce((a, t) => a + t.amount, 0) / 3;
  const approved = amount <= income * 3;
  c.limitRequest = { amount, status: approved ? 'aprobada' : 'rechazada' };
  if (approved) c.limit = amount;
  notify(d, 'sistema', `Aumento de límite ${approved ? 'aprobado' : 'rechazado'}`, approved ? `Tu nuevo límite es ${amount}.` : `Según tus ingresos, el máximo es ${round2(income * 3)}.`);
});

/* -------------------------- Ahorro y presupuesto ------------------------- */
export const createGoal = (s: BankState, name: string, target: number, deadline: string, emoji = '🎯') => mut(s, (d) => {
  assert(name.trim().length >= 3, 'nombre_debe_tener_minimo'); positive(target);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline > todayKey(), 'fecha_limite_debe_ser');
  d.goals.push({ id: uid('goal'), name: name.trim(), target, saved: 0, deadline, emoji });
});
export const contributeGoal = (s: BankState, goalId: string, accountId: string, amount: number) => mut(s, (d) => {
  const g = d.goals.find((x) => x.id === goalId); assert(g, 'meta_no_encontrada');
  debit(d, accountId, amount, `Aporte a meta "${g.name}"`, 'savings', { category: 'Ahorro' });
  g.saved = round2(g.saved + amount);
  if (g.saved >= g.target) notify(d, 'sistema', '¡Meta cumplida! 🎉', `Alcanzaste tu meta "${g.name}".`);
});
export const withdrawGoal = (s: BankState, goalId: string, accountId: string, amount: number) => mut(s, (d) => {
  const g = d.goals.find((x) => x.id === goalId); assert(g, 'meta_no_encontrada');
  assert(amount <= g.saved, 'solo_tenes_ahorrados_esta', { saved: g.saved.toFixed(2) });
  g.saved = round2(g.saved - amount);
  credit(d, accountId, amount, `Retiro de meta "${g.name}"`, 'savings', { category: 'Ahorro' });
});
export const deleteGoal = (s: BankState, goalId: string, accountId: string) => {
  const g = s.goals.find((x) => x.id === goalId); assert(g, 'meta_no_encontrada');
  const st = g.saved > 0 ? withdrawGoal(s, goalId, accountId, g.saved) : s;
  return mut(st, (d) => { d.goals = d.goals.filter((x) => x.id !== goalId); if (d.settings.roundUpGoalId === goalId) d.settings.roundUp = false; });
};
export const setRoundUp = (s: BankState, on: boolean, goalId?: string) => mut(s, (d) => {
  if (on) assert(goalId && d.goals.some((g) => g.id === goalId), 'elegi_meta_recibira_redondeos');
  d.settings.roundUp = on; d.settings.roundUpGoalId = on ? goalId : undefined;
});
export const setBudget = (s: BankState, category: Category, limit: number) => mut(s, (d) => {
  if (limit <= 0) { d.budgets = d.budgets.filter((b) => b.category !== category); return; }
  const b = d.budgets.find((x) => x.category === category);
  if (b) b.limit = limit; else d.budgets.push({ category, limit });
});
export function budgetStatus(s: BankState, month = new Date().toISOString().slice(0, 7)) {
  const spent = spendingByCategory(s, month);
  return s.budgets.map((b) => {
    const used = spent.find((x) => x.category === b.category)?.total ?? 0;
    return { ...b, used, pct: used / b.limit, over: used > b.limit, warn: used / b.limit >= 0.8 };
  });
}
export function fixedDepositReturn(amount: number, tna: number, days: number) {
  const interest = round2(amount * (tna / 100) * (days / 365));
  return { interest, total: round2(amount + interest), tea: round2(((1 + tna / 100 / (365 / days)) ** (365 / days) - 1) * 100) };
}
export const FD_RATES: Record<number, number> = { 30: 4.5, 60: 4.8, 90: 5.2, 180: 5.6, 365: 6.1 };
export const createFixedDeposit = (s: BankState, accountId: string, amount: number, days: number, autoRenew: boolean) => mut(s, (d) => {
  assert(FD_RATES[days], 'plazo_no_disponible'); assert(amount >= 100, 'monto_minimo_100');
  debit(d, accountId, amount, `Constitución plazo fijo ${days} días`, 'investment', { category: 'Inversiones' });
  d.fixedDeposits.push({ id: uid('fd'), accountId, amount, rate: FD_RATES[days], days, start: new Date().toISOString(), autoRenew, status: 'activo' });
});
export function matureDeposits(s: BankState): BankState {
  return mut(s, (d) => {
    d.fixedDeposits.filter((f) => f.status === 'activo').forEach((f) => {
      const end = new Date(f.start); end.setDate(end.getDate() + f.days);
      if (end > new Date()) return;
      const { total, interest } = fixedDepositReturn(f.amount, f.rate, f.days);
      if (f.autoRenew) { f.amount = total; f.start = end.toISOString(); notify(d, 'sistema', 'Plazo fijo renovado', `Intereses capitalizados: ${interest}.`); }
      else { f.status = 'cobrado'; credit(d, f.accountId, total, `Vencimiento plazo fijo (+${interest} intereses)`, 'interest', { category: 'Ingresos' }); }
    });
  });
}

/* -------------------------------- Préstamos ------------------------------ */
export function loanSimulation(principal: number, tna: number, months: number) {
  const i = tna / 100 / 12;
  const quota = i === 0 ? principal / months : (principal * i) / (1 - (1 + i) ** -months);
  let balance = principal;
  const schedule = Array.from({ length: months }, (_, k) => {
    const interest = balance * i; const capital = quota - interest; balance = Math.max(0, balance - capital);
    return { n: k + 1, quota: round2(quota), interest: round2(interest), capital: round2(capital), balance: round2(balance) };
  });
  return { quota: round2(quota), total: round2(quota * months), interest: round2(quota * months - principal), schedule };
}
export const LOAN_RATES: Record<Loan['kind'], number> = { personal: 14, auto: 11, hipotecario: 7.5 };
export const requestLoan = (s: BankState, kind: Loan['kind'], principal: number, months: number, accountId: string) => mut(s, (d) => {
  positive(principal);
  const max = kind === 'hipotecario' ? 300000 : kind === 'auto' ? 60000 : 30000;
  assert(principal >= 500 && principal <= max, 'monto_entre_500', { max: max });
  assert(months >= 6 && months <= (kind === 'hipotecario' ? 360 : 72), 'plazo_fuera_rango');
  const sim = loanSimulation(principal, LOAN_RATES[kind], months);
  const income = d.transactions.filter((t) => t.category === 'Ingresos' && t.amount > 0).slice(0, 3).reduce((a, t) => a + t.amount, 0) / 3;
  const currentDebt = d.loans.filter((l) => l.status === 'activo').reduce((a, l) => a + l.installment, 0);
  assert(sim.quota + currentDebt <= income * 0.4, 'cuota_supera_40_ingresos', { maxQuota: round2(income * 0.4 - currentDebt) });
  d.loans.push({ id: uid('loan'), kind, principal, rate: LOAN_RATES[kind], months, installment: sim.quota, paidInstallments: 0, outstanding: principal, accountId, startDate: new Date().toISOString(), status: 'activo' });
  credit(d, accountId, principal, `Acreditación préstamo ${kind}`, 'loan', { category: 'Préstamos' });
});
export const payLoanInstallment = (s: BankState, loanId: string, accountId: string) => mut(s, (d) => {
  const l = d.loans.find((x) => x.id === loanId); assert(l && l.status === 'activo', 'prestamo_no_activo');
  const interest = round2(l.outstanding * (l.rate / 100 / 12));
  const isLast = l.paidInstallments + 1 >= l.months;
  const amount = isLast ? round2(l.outstanding + interest) : l.installment;
  debit(d, accountId, amount, `Cuota ${l.paidInstallments + 1}/${l.months} préstamo ${l.kind}`, 'loan', { category: 'Préstamos' });
  l.paidInstallments += 1; l.outstanding = isLast ? 0 : round2(l.outstanding - (amount - interest));
  if (l.outstanding <= 0.01) { l.outstanding = 0; l.status = 'cancelado'; notify(d, 'sistema', 'Préstamo cancelado', '¡Terminaste de pagar tu préstamo!'); }
});
export const PREPAYMENT_FEE = 0.02;
export const prepayLoan = (s: BankState, loanId: string, accountId: string) => mut(s, (d) => {
  const l = d.loans.find((x) => x.id === loanId); assert(l && l.status === 'activo', 'prestamo_no_activo');
  const fee = round2(l.outstanding * PREPAYMENT_FEE);
  debit(d, accountId, l.outstanding, `Precancelación préstamo ${l.kind}`, 'loan', { category: 'Préstamos' });
  debit(d, accountId, fee, 'Comisión por precancelación (2%)', 'fee', { category: 'Comisiones' });
  l.outstanding = 0; l.status = 'cancelado';
});

/* ------------------------------- Inversiones ----------------------------- */
export const tickMarket = (s: BankState) => mut(s, (d) => {
  d.market.forEach((a) => {
    if (a.symbol === 'USDC') return;
    const vol = a.risk * 0.004; const move = (Math.random() - 0.5) * 2 * vol;
    a.price = round2(a.price * (1 + move)); a.change = round2(a.change + move * 100);
  });
});
export const buyAsset = (s: BankState, accountId: string, symbol: string, amountUsd: number) => mut(s, (d) => {
  const a = d.market.find((x) => x.symbol === symbol); assert(a, 'instrumento_no_encontrado');
  const acc = getAccount(d, accountId); assert(acc.currency === 'USD', 'inversiones_operan_desde_cuenta');
  assert(amountUsd >= 10, 'monto_minimo_inversion_10');
  if (a.risk >= 4) assert(d.settings.investorProfile && d.settings.investorProfile !== 'conservador', 'este_instrumento_requiere_perfil');
  const commission = round2(amountUsd * 0.005);
  const qty = (amountUsd - commission) / a.price;
  debit(d, accountId, amountUsd, `Compra ${a.symbol} (${qty.toFixed(6)} u.)`, 'investment', { category: 'Inversiones' });
  const h = d.holdings.find((x) => x.symbol === symbol);
  if (h) { h.avgPrice = round2((h.avgPrice * h.qty + a.price * qty) / (h.qty + qty)); h.qty += qty; }
  else d.holdings.push({ symbol, qty, avgPrice: a.price });
});
export const sellAsset = (s: BankState, accountId: string, symbol: string, qty: number) => mut(s, (d) => {
  const a = d.market.find((x) => x.symbol === symbol); const h = d.holdings.find((x) => x.symbol === symbol);
  assert(a && h, 'no_tenes_este_instrumento'); positive(qty);
  assert(qty <= h.qty + 1e-9, 'tenes_unidades', { qty: h.qty.toFixed(6) });
  const acc = getAccount(d, accountId); assert(acc.currency === 'USD', 'acreditamos_ventas_cuentas_usd');
  const gross = qty * a.price; const net = round2(gross * 0.995);
  credit(d, accountId, net, `Venta ${a.symbol} (${qty.toFixed(6)} u.)`, 'investment', { category: 'Inversiones' });
  h.qty -= qty; if (h.qty < 1e-9) d.holdings = d.holdings.filter((x) => x.symbol !== symbol);
});
export function portfolio(s: BankState) {
  const rows = s.holdings.map((h) => {
    const a = s.market.find((m) => m.symbol === h.symbol)!;
    const value = round2(h.qty * a.price); const cost = round2(h.qty * h.avgPrice);
    return { ...h, asset: a, value, cost, pnl: round2(value - cost), pnlPct: cost ? round2(((value - cost) / cost) * 100) : 0 };
  });
  const fd = s.fixedDeposits.filter((f) => f.status === 'activo').reduce((a, f) => a + convert(f.amount, s.accounts.find((x) => x.id === f.accountId)?.currency ?? 'USD', 'USD'), 0);
  return { rows, total: round2(rows.reduce((a, r) => a + r.value, 0) + fd), pnl: round2(rows.reduce((a, r) => a + r.pnl, 0)), fixedDeposits: round2(fd) };
}
export function investorProfile(answers: number[]): 'conservador' | 'moderado' | 'agresivo' {
  const score = answers.reduce((a, b) => a + b, 0);
  return score <= 5 ? 'conservador' : score <= 9 ? 'moderado' : 'agresivo';
}
export const setInvestorProfile = (s: BankState, answers: number[]) => mut(s, (d) => {
  assert(answers.length === 5 && answers.every((a) => a >= 0), 'responde_todas_preguntas');
  d.settings.investorProfile = investorProfile(answers);
});
export const exchangeCurrency = (s: BankState, fromId: string, toId: string, amount: number) => {
  const from = getAccount(s, fromId); const to = getAccount(s, toId);
  assert(from.currency !== to.currency, 'elegi_cuentas_distinta_moneda');
  return transferOwn(s, fromId, toId, amount, `Cambio ${from.currency}→${to.currency}`);
};

/* --------------------------------- Seguros ------------------------------- */
export const INSURANCE_BASE: Record<Insurance['type'], { rate: number; min: number; max: number }> = {
  Vida: { rate: 0.0006, min: 10000, max: 500000 }, Hogar: { rate: 0.0004, min: 10000, max: 300000 },
  Auto: { rate: 0.004, min: 5000, max: 100000 }, Viaje: { rate: 0.002, min: 1000, max: 100000 },
  Salud: { rate: 0.0025, min: 5000, max: 200000 }, Celular: { rate: 0.012, min: 200, max: 3000 },
};
export function quoteInsurance(type: Insurance['type'], coverage: number, age = 33) {
  const b = INSURANCE_BASE[type];
  assert(coverage >= b.min && coverage <= b.max, 'cobertura_entre', { min: b.min, max: b.max });
  const ageFactor = type === 'Vida' || type === 'Salud' ? 1 + Math.max(0, age - 30) * 0.03 : 1;
  return round2(coverage * b.rate * ageFactor);
}
export const contractInsurance = (s: BankState, type: Insurance['type'], coverage: number, accountId: string) => mut(s, (d) => {
  assert(!d.insurances.some((i) => i.type === type && i.status === 'vigente'), 'ya_tenes_seguro_vigente', { type: type });
  const age = Math.floor((Date.now() - new Date(d.user.birthDate).getTime()) / 3.15576e10);
  const premium = quoteInsurance(type, coverage, age);
  debit(d, accountId, premium, `Primer pago seguro ${type}`, 'payment', { category: 'Servicios' });
  d.insurances.push({ id: uid('ins'), type, premium, coverage, start: new Date().toISOString(), status: 'vigente' });
});
export const cancelInsurance = (s: BankState, id: string) => mut(s, (d) => {
  const i = d.insurances.find((x) => x.id === id); assert(i && i.status === 'vigente', 'seguro_no_vigente'); i.status = 'cancelado';
});
export const fileClaim = (s: BankState, insuranceId: string, description: string) => mut(s, (d) => {
  const i = d.insurances.find((x) => x.id === insuranceId); assert(i && i.status === 'vigente', 'elegi_seguro_vigente');
  assert(description.trim().length >= 15, 'describi_siniestro_minimo_15');
  d.claims.unshift({ id: uid('clm'), insuranceId, description: description.trim(), date: new Date().toISOString(), status: 'recibido' });
  notify(d, 'sistema', 'Siniestro recibido', `Seguro de ${i.type}. Un asesor te contactará en 48 h.`);
});

/* --------------------- Notificaciones, perfil y soporte ------------------ */
export const markNotification = (s: BankState, id: string | 'all') => mut(s, (d) => {
  d.notifications.forEach((n) => { if (id === 'all' || n.id === id) n.read = true; });
});
export const deleteNotification = (s: BankState, id: string) => mut(s, (d) => { d.notifications = d.notifications.filter((n) => n.id !== id); });
export const readMessage = (s: BankState, id: string) => mut(s, (d) => { const m = d.inbox.find((x) => x.id === id); if (m) m.read = true; });
export const acceptOffer = (s: BankState, id: string) => mut(s, (d) => {
  const o = d.offers.find((x) => x.id === id); assert(o && !o.accepted, 'oferta_no_disponible'); o.accepted = true;
});
export const updateProfile = (s: BankState, p: { name: string; email: string; phone: string; address: string }) => mut(s, (d) => {
  assert(p.name.trim().length >= 3, 'nombre_invalido');
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()), 'email_invalido');
  assert(/^\+?[\d\s-]{8,18}$/.test(p.phone.trim()), 'telefono_invalido');
  Object.assign(d.user, { name: p.name.trim(), email: p.email.trim(), phone: p.phone.trim(), address: p.address.trim() });
});
export const redeemReward = (s: BankState, rewardId: string, accountId: string) => mut(s, (d) => {
  const r = d.rewards.find((x) => x.id === rewardId); assert(r, 'recompensa_no_encontrada');
  assert(d.user.points >= r.points, 'te_faltan_puntos', { missing: r.points - d.user.points });
  d.user.points -= r.points;
  if (r.id === 'rw-1') credit(d, accountId, 10, 'Canje de puntos', 'deposit', { category: 'Ingresos' });
  notify(d, 'sistema', 'Canje realizado', `${r.name} (−${r.points} pts).`);
});
export const addReferral = (s: BankState, name: string) => mut(s, (d) => {
  assert(name.trim().length >= 3, 'indica_nombre_amigo');
  assert(!d.user.referrals.includes(name.trim()), 'ya_lo_invitaste');
  d.user.referrals.push(name.trim()); d.user.points += 500;
});
export const createTicket = (s: BankState, subject: string, category: string, description: string) => mut(s, (d) => {
  assert(subject.trim().length >= 5, 'asunto_debe_tener_minimo');
  assert(description.trim().length >= 20, 'describi_problema_minimo_20');
  d.tickets.unshift({ id: `TK-${Math.floor(10000 + Math.random() * 89999)}`, subject: subject.trim(), category, description: description.trim(), date: new Date().toISOString(), status: 'abierto' });
});
export const addEmergencyContact = (s: BankState, name: string, phone: string, relation: string) => mut(s, (d) => {
  assert(name.trim().length >= 3, 'nombre_invalido'); assert(/^\+?[\d\s-]{8,18}$/.test(phone.trim()), 'telefono_invalido');
  d.emergencyContacts.push({ id: uid('ct'), name: name.trim(), phone: phone.trim(), relation: relation.trim() || 'Familiar' });
});
export const removeEmergencyContact = (s: BankState, id: string) => mut(s, (d) => { d.emergencyContacts = d.emergencyContacts.filter((c) => c.id !== id); });

/** Respuestas del asistente virtual basadas en intención + datos del usuario. */
export function assistantReply(s: BankState, text: string): string {
  const t = text.toLowerCase();
  const primary = s.accounts.find((a) => a.isPrimary)!;
  if (/saldo|cu[aá]nto tengo|balance/.test(t)) return `Tu saldo total es ${totalBalance(s, 'USD').toFixed(2)} USD. En ${primary.alias} tenés ${primary.balance.toFixed(2)} ${primary.currency}.`;
  if (/gast|consum/.test(t)) { const top = spendingByCategory(s, new Date().toISOString().slice(0, 7))[0]; return top ? `Este mes tu mayor gasto es ${top.category}: ${top.total.toFixed(2)} USD.` : 'Aún no registrás gastos este mes.'; }
  if (/tarjeta|bloque/.test(t)) return 'Podés bloquear o desbloquear tus tarjetas desde la pestaña Tarjetas. Si fue robada, usá "Denunciar robo/pérdida".';
  if (/transfer/.test(t)) return `Podés transferir hasta ${s.settings.perTransferLimit} USD por operación y ${s.settings.dailyTransferLimit} USD diarios. Andá a Pagos → Transferir.`;
  if (/pr[eé]stamo|cr[eé]dito/.test(t)) return `Las tasas actuales son: personal ${LOAN_RATES.personal}%, auto ${LOAN_RATES.auto}%, hipotecario ${LOAN_RATES.hipotecario}% TNA. Probá el simulador.`;
  if (/vence|factura|servicio/.test(t)) { const n = s.services.filter((x) => x.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]; return n ? `Tu próximo vencimiento es ${n.company} (${n.amountDue.toFixed(2)} USD) el ${n.dueDate}.` : 'No tenés facturas pendientes.'; }
  if (/punto|recompensa/.test(t)) return `Tenés ${s.user.points} puntos disponibles para canjear.`;
  if (/hola|buen/.test(t)) return `¡Hola ${s.user.name.split(' ')[0]}! ¿En qué te ayudo? Puedo responder sobre saldos, gastos, tarjetas, transferencias, préstamos y vencimientos.`;
  if (/humano|asesor|persona/.test(t)) return 'Te derivo con un asesor. También podés crear un ticket de soporte o llamar al 0800-BANCO-PLUS.';
  return 'No estoy seguro de haber entendido. Probá preguntar por "saldo", "gastos", "tarjeta", "transferir", "préstamo" o "vencimientos".';
}

export const accountCertificate = (s: BankState, accountId: string) => {
  const a = getAccount(s, accountId);
  return `CERTIFICADO DE CUENTA\n\nBanco Plus certifica que ${s.user.name} (${s.user.documentId}) es titular de la cuenta ${a.type} N° ${a.number}, código interbancario ${a.interbankCode}, en ${a.currency}, abierta el ${a.createdAt.slice(0, 10)}, la cual se encuentra activa.\n\nEmitido el ${new Date().toISOString().slice(0, 10)}. Código de verificación: ${otpCode(a.id + 'cert')}.`;
};
