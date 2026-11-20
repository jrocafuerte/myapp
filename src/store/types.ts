export type Currency = 'USD' | 'EUR' | 'GBP';

export type Category =
  | 'Supermercado'
  | 'Restaurantes'
  | 'Transporte'
  | 'Servicios'
  | 'Salud'
  | 'Entretenimiento'
  | 'Compras'
  | 'Educación'
  | 'Vivienda'
  | 'Suscripciones'
  | 'Transferencias'
  | 'Ingresos'
  | 'Inversiones'
  | 'Ahorro'
  | 'Préstamos'
  | 'Impuestos'
  | 'Comisiones'
  | 'Otros';

export type TxType =
  | 'transfer'
  | 'payment'
  | 'card'
  | 'deposit'
  | 'fee'
  | 'interest'
  | 'investment'
  | 'loan'
  | 'fx'
  | 'savings';

export interface Account {
  id: string;
  alias: string;
  type: 'ahorro' | 'corriente' | 'nomina';
  currency: Currency;
  balance: number;
  number: string;
  interbankCode: string;
  isPrimary: boolean;
  closed: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number; // positivo = ingreso, negativo = egreso
  category: Category;
  type: TxType;
  note?: string;
  counterpart?: string;
  reference: string;
}

export interface Card {
  id: string;
  kind: 'debito' | 'credito';
  virtual: boolean;
  oneTime: boolean;
  brand: 'Visa' | 'Mastercard';
  number: string;
  cvv: string;
  expiry: string;
  holder: string;
  accountId: string;
  status: 'activa' | 'bloqueada' | 'cancelada';
  pin: string;
  limit: number; // límite de crédito o de gasto mensual
  used: number; // saldo consumido del mes (crédito: deuda actual)
  onlineEnabled: boolean;
  abroadEnabled: boolean;
  travelNotice?: { country: string; from: string; to: string };
  dueDate: string;
  limitRequest?: { amount: number; status: 'pendiente' | 'aprobada' | 'rechazada' };
}

export interface Beneficiary {
  id: string;
  name: string;
  bank: string;
  accountNumber: string;
  alias: string;
  currency: Currency;
  favorite: boolean;
  international?: { swift: string; country: string };
}

export interface ScheduledTransfer {
  id: string;
  fromId: string;
  beneficiaryId: string;
  amount: number;
  nextDate: string;
  frequency: 'unica' | 'semanal' | 'mensual';
  concept: string;
  active: boolean;
}

export interface Service {
  id: string;
  company: string;
  type: 'Luz' | 'Agua' | 'Gas' | 'Internet' | 'Telefonía' | 'TV' | 'Impuestos' | 'Otro';
  customerNumber: string;
  amountDue: number;
  dueDate: string;
  autoDebit: boolean;
  autoDebitAccountId?: string;
  reminder: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  emoji: string;
}

export interface Budget {
  category: Category;
  limit: number;
}

export interface FixedDeposit {
  id: string;
  accountId: string;
  amount: number;
  rate: number; // TNA %
  days: number;
  start: string;
  autoRenew: boolean;
  status: 'activo' | 'cobrado';
}

export interface Loan {
  id: string;
  kind: 'personal' | 'hipotecario' | 'auto';
  principal: number;
  rate: number; // TNA %
  months: number;
  installment: number;
  paidInstallments: number;
  outstanding: number;
  accountId: string;
  startDate: string;
  status: 'activo' | 'cancelado';
}

export interface MarketAsset {
  symbol: string;
  name: string;
  type: 'accion' | 'fondo' | 'cripto' | 'bono' | 'etf';
  price: number;
  change: number; // % diario
  risk: 1 | 2 | 3 | 4 | 5;
}

export interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface Insurance {
  id: string;
  type: 'Vida' | 'Hogar' | 'Auto' | 'Viaje' | 'Salud' | 'Celular';
  premium: number;
  coverage: number;
  start: string;
  status: 'vigente' | 'cancelado';
}

export interface Claim {
  id: string;
  insuranceId: string;
  description: string;
  date: string;
  status: 'recibido' | 'en revisión' | 'aprobado';
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  kind: 'seguridad' | 'movimiento' | 'pago' | 'promo' | 'sistema';
}

export interface InboxMessage {
  id: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
}

export interface Device {
  id: string;
  name: string;
  lastActive: string;
  current: boolean;
}

export interface LoginEvent {
  id: string;
  date: string;
  device: string;
  method: 'contraseña' | 'biometría' | 'PIN';
  success: boolean;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  date: string;
  status: 'abierto' | 'en curso' | 'resuelto';
}

export interface PaymentRequest {
  id: string;
  direction: 'enviada' | 'recibida';
  counterpart: string;
  amount: number;
  concept: string;
  date: string;
  status: 'pendiente' | 'pagada' | 'rechazada';
}

export interface SplitBill {
  id: string;
  concept: string;
  total: number;
  participants: { name: string; share: number; paid: boolean }[];
  date: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  pointsCost?: number;
  accepted: boolean;
}

export interface Reward {
  id: string;
  name: string;
  points: number;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface Settings {
  biometricEnabled: boolean;
  pin?: string;
  twoFactor: boolean;
  autoLockMinutes: number;
  hideBalances: boolean;
  darkMode: 'sistema' | 'claro' | 'oscuro';
  language: 'es' | 'en';
  displayCurrency: Currency;
  roundUp: boolean;
  roundUpGoalId?: string;
  dailyTransferLimit: number;
  perTransferLimit: number;
  lowBalanceThreshold: number;
  largeTxThreshold: number;
  notifPrefs: Record<AppNotification['kind'], { push: boolean; email: boolean; sms: boolean }>;
  securityQuestions: { question: string; answer: string }[];
  investorProfile?: 'conservador' | 'moderado' | 'agresivo';
  travelMode: boolean;
  quickBalanceWidget: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  documentId: string;
  birthDate: string;
  avatarColor: string;
  username: string;
  password: string;
  referralCode: string;
  referrals: string[];
  points: number;
  emergencyLocked: boolean;
}

export interface BankState {
  version: number;
  user: UserProfile;
  settings: Settings;
  accounts: Account[];
  transactions: Transaction[];
  cards: Card[];
  beneficiaries: Beneficiary[];
  scheduled: ScheduledTransfer[];
  services: Service[];
  goals: SavingsGoal[];
  budgets: Budget[];
  fixedDeposits: FixedDeposit[];
  loans: Loan[];
  market: MarketAsset[];
  holdings: Holding[];
  insurances: Insurance[];
  claims: Claim[];
  notifications: AppNotification[];
  inbox: InboxMessage[];
  devices: Device[];
  loginHistory: LoginEvent[];
  tickets: Ticket[];
  requests: PaymentRequest[];
  splits: SplitBill[];
  offers: Offer[];
  rewards: Reward[];
  emergencyContacts: Contact[];
  transferredToday: { date: string; amount: number };
}
