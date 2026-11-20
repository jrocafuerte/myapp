/**
 * CATÁLOGO DE COMANDOS — las únicas operaciones que el cliente puede pedir.
 *
 * Un comando es serializable ({ name, args }) para viajar de la app al BFF. Los tipos de
 * `args` salen de las funciones de logic.ts, así que el compilador avisa si cambian.
 * `domain` decide qué Lambda lo atiende y qué adaptador del banco lo ejecuta.
 */
import * as L from './logic';
import type { BankState } from './types';

export const COMMAND_DOMAINS = {
  // Cuentas y movimientos
  openAccount: 'accounts', renameAccount: 'accounts', setPrimaryAccount: 'accounts', closeAccount: 'accounts',
  setTxCategory: 'accounts', setTxNote: 'accounts',
  // Transferencias
  transferOwn: 'transfers', transferToBeneficiary: 'transfers', transferByAlias: 'transfers', transferInternational: 'transfers',
  addBeneficiary: 'transfers', removeBeneficiary: 'transfers', toggleFavorite: 'transfers', scheduleTransfer: 'transfers',
  cancelScheduled: 'transfers', setTransferLimits: 'transfers', requestMoney: 'transfers', answerRequest: 'transfers',
  createSplit: 'transfers', markSplitPaid: 'transfers',
  // Pagos
  payService: 'payments', addService: 'payments', removeService: 'payments', setAutoDebit: 'payments', setReminder: 'payments',
  mobileTopUp: 'payments', transportTopUp: 'payments', payTax: 'payments', payQr: 'payments',
  // Tarjetas
  setCardStatus: 'cards', reportCard: 'cards', createVirtualCard: 'cards', changeCardPin: 'cards', setCardLimit: 'cards',
  setCardFlag: 'cards', setTravelNotice: 'cards', cardPurchase: 'cards', payCreditCard: 'cards', requestLimitIncrease: 'cards',
  // Ahorro y presupuesto
  createGoal: 'savings', contributeGoal: 'savings', withdrawGoal: 'savings', deleteGoal: 'savings', setRoundUp: 'savings',
  setBudget: 'savings', createFixedDeposit: 'savings',
  // Préstamos
  requestLoan: 'loans', payLoanInstallment: 'loans', prepayLoan: 'loans',
  // Inversiones
  buyAsset: 'investments', sellAsset: 'investments', setInvestorProfile: 'investments', exchangeCurrency: 'investments',
  // Seguros
  contractInsurance: 'insurance', cancelInsurance: 'insurance', fileClaim: 'insurance',
  // Perfil, seguridad, notificaciones y soporte
  setPin: 'profile', removePin: 'profile', setSecurityQuestions: 'profile', revokeDevice: 'profile', setEmergencyLock: 'profile',
  updatePreferences: 'profile', setNotificationPref: 'profile', setAlertThreshold: 'profile', setAvatarColor: 'profile',
  updateProfile: 'profile', markNotification: 'profile', deleteNotification: 'profile', readMessage: 'profile', acceptOffer: 'profile',
  redeemReward: 'profile', addReferral: 'profile', createTicket: 'profile', addEmergencyContact: 'profile', removeEmergencyContact: 'profile',
} as const;

export type CommandName = keyof typeof COMMAND_DOMAINS;
export type Domain = (typeof COMMAND_DOMAINS)[CommandName];
export const DOMAINS = [...new Set(Object.values(COMMAND_DOMAINS))] as Domain[];

type Fn = (s: BankState, ...args: never[]) => BankState;
type ArgsOf<F> = F extends (s: BankState, ...args: infer A) => BankState ? A : never;
export type CommandArgs<K extends CommandName> = ArgsOf<(typeof L)[K]>;
export interface Command<K extends CommandName = CommandName> { name: K; args: CommandArgs<K> }

/** Constructor tipado: `cmd.transferOwn('acc-1', 'acc-2', 100)` → `{ name: 'transferOwn', args: [...] }`. */
export const cmd = new Proxy({} as { [K in CommandName]: (...args: CommandArgs<K>) => Command<K> }, {
  get: (_, name: string) => (...args: unknown[]) => {
    if (!(name in COMMAND_DOMAINS)) throw new Error(`Comando desconocido: ${name}`);
    return { name, args };
  },
});

export const isCommandName = (x: unknown): x is CommandName => typeof x === 'string' && Object.prototype.hasOwnProperty.call(COMMAND_DOMAINS, x);

/** Ejecuta un comando sobre un estado con la lógica de negocio. Lanza BankError si no se puede. */
export function applyCommand(state: BankState, command: Command): BankState {
  if (!isCommandName(command.name)) throw new Error(`Comando desconocido: ${String(command.name)}`);
  const fn = L[command.name] as unknown as Fn;
  return fn(state, ...(command.args as never[]));
}
