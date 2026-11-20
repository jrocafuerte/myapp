import type { BankState, Category, Transaction } from './types';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const daysAgo = (n: number, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysAhead = (n: number) => daysAgo(-n);

const merchants: { d: string; c: Category; min: number; max: number }[] = [
  { d: 'Supermercado Central', c: 'Supermercado', min: 25, max: 180 },
  { d: 'Mercado Fresco', c: 'Supermercado', min: 10, max: 60 },
  { d: 'Café Aroma', c: 'Restaurantes', min: 4, max: 15 },
  { d: 'Restaurante La Plaza', c: 'Restaurantes', min: 20, max: 85 },
  { d: 'Uber', c: 'Transporte', min: 6, max: 30 },
  { d: 'Gasolinera Norte', c: 'Transporte', min: 30, max: 70 },
  { d: 'Farmacia Salud', c: 'Salud', min: 8, max: 60 },
  { d: 'Cine Estrella', c: 'Entretenimiento', min: 10, max: 35 },
  { d: 'Tienda Online', c: 'Compras', min: 15, max: 220 },
  { d: 'Librería Saber', c: 'Educación', min: 10, max: 70 },
];

function buildTransactions(): Transaction[] {
  const r = rng(42);
  const txs: Transaction[] = [];
  let n = 0;
  const ref = () => `REF${(100000 + n++).toString()}`;
  for (let m = 0; m < 3; m++) {
    txs.push({
      id: `seed-sal-${m}`, accountId: 'acc-1', date: daysAgo(m * 30 + 2), description: 'Nómina Empresa S.A.',
      amount: 3200, category: 'Ingresos', type: 'deposit', counterpart: 'Empresa S.A.', reference: ref(),
    });
    txs.push({
      id: `seed-rent-${m}`, accountId: 'acc-1', date: daysAgo(m * 30 + 4), description: 'Alquiler departamento',
      amount: -950, category: 'Vivienda', type: 'transfer', counterpart: 'Inmobiliaria Sur', reference: ref(),
    });
    for (const [desc, amt] of [['Netflix', 15.99], ['Spotify', 10.99], ['Gimnasio FitClub', 35]] as const) {
      txs.push({
        id: `seed-sub-${desc}-${m}`, accountId: 'acc-1', date: daysAgo(m * 30 + 6), description: desc,
        amount: -amt, category: 'Suscripciones', type: 'card', reference: ref(),
      });
    }
    txs.push({
      id: `seed-luz-${m}`, accountId: 'acc-1', date: daysAgo(m * 30 + 10), description: 'Pago Luz - Electro Sur',
      amount: -(60 + Math.round(r() * 30)), category: 'Servicios', type: 'payment', reference: ref(),
    });
    for (let i = 0; i < 14; i++) {
      const mm = merchants[Math.floor(r() * merchants.length)];
      txs.push({
        id: `seed-${m}-${i}`, accountId: r() > 0.85 ? 'acc-2' : 'acc-1', date: daysAgo(m * 30 + Math.floor(r() * 29)),
        description: mm.d, amount: -Math.round((mm.min + r() * (mm.max - mm.min)) * 100) / 100,
        category: mm.c, type: 'card', reference: ref(),
      });
    }
  }
  txs.push({
    id: 'seed-int', accountId: 'acc-2', date: daysAgo(1), description: 'Intereses ganados', amount: 12.4,
    category: 'Ingresos', type: 'interest', reference: ref(),
  });
  return txs.sort((a, b) => b.date.localeCompare(a.date));
}

export function createSeed(): BankState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 1,
    user: {
      name: 'Ana García', email: 'ana.garcia@correo.com', phone: '+1 555 010 2030', address: 'Av. Principal 123',
      documentId: 'ID-48291034', birthDate: '1992-04-18', avatarColor: '#0047AB', username: 'demo', password: 'demo1234',
      referralCode: 'ANA-7Q2X', referrals: ['Luis P.'], points: 2450, emergencyLocked: false,
    },
    settings: {
      biometricEnabled: false, twoFactor: true, autoLockMinutes: 5, hideBalances: false, darkMode: 'sistema',
      language: 'es', displayCurrency: 'USD', roundUp: false, dailyTransferLimit: 5000, perTransferLimit: 2500,
      lowBalanceThreshold: 200, largeTxThreshold: 500,
      notifPrefs: {
        seguridad: { push: true, email: true, sms: true }, movimiento: { push: true, email: false, sms: false },
        pago: { push: true, email: true, sms: false }, promo: { push: false, email: true, sms: false },
        sistema: { push: true, email: false, sms: false },
      },
      securityQuestions: [], travelMode: false, quickBalanceWidget: true,
    },
    accounts: [
      { id: 'acc-1', alias: 'Cuenta Nómina', type: 'nomina', currency: 'USD', balance: 4820.35, number: '0012-4589-7731',
        interbankCode: '01200124589773100012', isPrimary: true, closed: false, createdAt: daysAgo(900) },
      { id: 'acc-2', alias: 'Ahorros', type: 'ahorro', currency: 'USD', balance: 12650, number: '0012-4589-9902',
        interbankCode: '01200124589990200034', isPrimary: false, closed: false, createdAt: daysAgo(600) },
      { id: 'acc-3', alias: 'Euros viaje', type: 'ahorro', currency: 'EUR', balance: 820, number: '0012-7001-1123',
        interbankCode: '01200127001112300056', isPrimary: false, closed: false, createdAt: daysAgo(200) },
    ],
    transactions: buildTransactions(),
    cards: [
      { id: 'card-1', kind: 'debito', virtual: false, oneTime: false, brand: 'Visa', number: '4532015112830366', cvv: '123',
        expiry: '09/29', holder: 'ANA GARCIA', accountId: 'acc-1', status: 'activa', pin: '1234', limit: 3000, used: 640,
        onlineEnabled: true, abroadEnabled: false, dueDate: daysAhead(12) },
      { id: 'card-2', kind: 'credito', virtual: false, oneTime: false, brand: 'Mastercard', number: '5425233430109903', cvv: '456',
        expiry: '03/28', holder: 'ANA GARCIA', accountId: 'acc-1', status: 'activa', pin: '4321', limit: 6000, used: 1385.4,
        onlineEnabled: true, abroadEnabled: true, dueDate: daysAhead(9) },
    ],
    beneficiaries: [
      { id: 'ben-1', name: 'Carlos Méndez', bank: 'Banco Nacional', accountNumber: '0045-1122-3344', alias: 'carlos.mendez',
        currency: 'USD', favorite: true },
      { id: 'ben-2', name: 'María López', bank: 'Banco Plus', accountNumber: '0012-9988-7766', alias: 'maria.lopez',
        currency: 'USD', favorite: false },
      { id: 'ben-3', name: 'Inmobiliaria Sur', bank: 'Banco Andino', accountNumber: '0077-5544-1100', alias: 'inmo.sur',
        currency: 'USD', favorite: false },
    ],
    scheduled: [
      { id: 'sch-1', fromId: 'acc-1', beneficiaryId: 'ben-3', amount: 950, nextDate: daysAhead(4).slice(0, 10),
        frequency: 'mensual', concept: 'Alquiler', active: true },
    ],
    services: [
      { id: 'srv-1', company: 'Electro Sur', type: 'Luz', customerNumber: '778812', amountDue: 74.3, dueDate: daysAhead(6).slice(0, 10),
        autoDebit: false, reminder: true },
      { id: 'srv-2', company: 'Aguas Claras', type: 'Agua', customerNumber: '55120', amountDue: 31.8, dueDate: daysAhead(15).slice(0, 10),
        autoDebit: true, autoDebitAccountId: 'acc-1', reminder: true },
      { id: 'srv-3', company: 'FibraNet', type: 'Internet', customerNumber: 'FN-9921', amountDue: 45, dueDate: daysAhead(2).slice(0, 10),
        autoDebit: false, reminder: true },
    ],
    goals: [
      { id: 'goal-1', name: 'Vacaciones', target: 3000, saved: 1250, deadline: daysAhead(180).slice(0, 10), emoji: '🏖️' },
      { id: 'goal-2', name: 'Fondo de emergencia', target: 10000, saved: 6400, deadline: daysAhead(365).slice(0, 10), emoji: '🛟' },
    ],
    budgets: [
      { category: 'Supermercado', limit: 450 }, { category: 'Restaurantes', limit: 200 }, { category: 'Transporte', limit: 150 },
      { category: 'Entretenimiento', limit: 80 },
    ],
    fixedDeposits: [
      { id: 'fd-1', accountId: 'acc-2', amount: 5000, rate: 5.2, days: 90, start: daysAgo(40), autoRenew: false, status: 'activo' },
    ],
    loans: [
      { id: 'loan-1', kind: 'personal', principal: 8000, rate: 14, months: 24, installment: 384.1, paidInstallments: 7,
        outstanding: 5850.2, accountId: 'acc-1', startDate: daysAgo(210), status: 'activo' },
    ],
    market: [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'accion', price: 228.5, change: 0.8, risk: 3 },
      { symbol: 'MSFT', name: 'Microsoft', type: 'accion', price: 431.2, change: -0.4, risk: 3 },
      { symbol: 'TSLA', name: 'Tesla', type: 'accion', price: 251.7, change: 2.1, risk: 5 },
      { symbol: 'SPY', name: 'S&P 500 ETF', type: 'etf', price: 571.3, change: 0.3, risk: 3 },
      { symbol: 'FCI-RF', name: 'Fondo Renta Fija Plus', type: 'fondo', price: 12.45, change: 0.05, risk: 1 },
      { symbol: 'FCI-MIX', name: 'Fondo Balanceado', type: 'fondo', price: 18.9, change: 0.2, risk: 2 },
      { symbol: 'FCI-ACC', name: 'Fondo Acciones Global', type: 'fondo', price: 25.1, change: 0.9, risk: 4 },
      { symbol: 'UST10', name: 'Bono Tesoro 10 años', type: 'bono', price: 98.2, change: -0.1, risk: 1 },
      { symbol: 'BTC', name: 'Bitcoin', type: 'cripto', price: 67250, change: 1.8, risk: 5 },
      { symbol: 'ETH', name: 'Ethereum', type: 'cripto', price: 3120, change: -1.2, risk: 5 },
      { symbol: 'USDC', name: 'USD Coin', type: 'cripto', price: 1, change: 0, risk: 2 },
    ],
    holdings: [
      { symbol: 'AAPL', qty: 10, avgPrice: 190 },
      { symbol: 'FCI-RF', qty: 200, avgPrice: 12.1 },
      { symbol: 'BTC', qty: 0.02, avgPrice: 52000 },
    ],
    insurances: [
      { id: 'ins-1', type: 'Hogar', premium: 18.5, coverage: 50000, start: daysAgo(300), status: 'vigente' },
    ],
    claims: [],
    notifications: [
      { id: 'n-1', title: 'Nuevo ingreso', body: 'Recibiste $3,200.00 de Empresa S.A.', date: daysAgo(2), read: false, kind: 'movimiento' },
      { id: 'n-2', title: 'Vence tu factura', body: 'FibraNet vence en 2 días.', date: daysAgo(0), read: false, kind: 'pago' },
      { id: 'n-3', title: 'Inicio de sesión', body: 'Nuevo acceso desde iPhone 15.', date: daysAgo(5), read: true, kind: 'seguridad' },
    ],
    inbox: [
      { id: 'm-1', subject: 'Bienvenida a Banco Plus', body: 'Gracias por elegirnos. Explorá todas las funcionalidades desde la pestaña "Más".', date: daysAgo(30), read: true },
      { id: 'm-2', subject: 'Actualización de términos', body: 'Actualizamos los términos y condiciones de tarjetas de crédito. Podés consultarlos en Documentos.', date: daysAgo(3), read: false },
    ],
    devices: [
      { id: 'dev-1', name: 'Este dispositivo', lastActive: daysAgo(0), current: true },
      { id: 'dev-2', name: 'iPhone 15 de Ana', lastActive: daysAgo(5), current: false },
      { id: 'dev-3', name: 'Chrome · Windows', lastActive: daysAgo(21), current: false },
    ],
    loginHistory: [
      { id: 'l-1', date: daysAgo(5), device: 'iPhone 15 de Ana', method: 'biometría', success: true },
      { id: 'l-2', date: daysAgo(9), device: 'Chrome · Windows', method: 'contraseña', success: false },
    ],
    tickets: [],
    requests: [
      { id: 'req-1', direction: 'recibida', counterpart: 'María López', amount: 25, concept: 'Cena del viernes', date: daysAgo(1), status: 'pendiente' },
    ],
    splits: [],
    offers: [
      { id: 'of-1', title: '10% de reintegro en supermercados', description: 'Los miércoles con tu tarjeta de crédito, tope $30.', accepted: false },
      { id: 'of-2', title: 'Préstamo pre-aprobado', description: 'Tenés hasta $15,000 pre-aprobados a 12% TNA.', accepted: false },
      { id: 'of-3', title: 'Doble de puntos en viajes', description: 'Durante este mes sumá el doble de puntos en aerolíneas.', accepted: false },
    ],
    rewards: [
      { id: 'rw-1', name: 'Crédito de $10 en cuenta', points: 1000 },
      { id: 'rw-2', name: 'Entrada de cine', points: 1500 },
      { id: 'rw-3', name: '2.000 millas aéreas', points: 3000 },
      { id: 'rw-4', name: 'Donación a ONG', points: 500 },
    ],
    emergencyContacts: [],
    transferredToday: { date: today, amount: 0 },
  };
}
