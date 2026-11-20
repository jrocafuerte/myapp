/**
 * Validación de entrada de cada comando (defensa en profundidad: la lógica también valida reglas de negocio).
 * `satisfies` obliga a que cada esquema produzca exactamente los argumentos de su función en logic.ts:
 * si una firma cambia, `npm run typecheck` falla aquí.
 */
import { z } from 'zod';
import type { CommandArgs, CommandName } from '../../../shared/domain/commands';

const id = z.string().min(1).max(80);
const text = (max = 200) => z.string().max(max);
const amount = z.number().finite().gt(0).lt(10_000_000);
const num = z.number().finite();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currency = z.enum(['USD', 'EUR', 'GBP']);
const category = z.enum(['Supermercado', 'Restaurantes', 'Transporte', 'Servicios', 'Salud', 'Entretenimiento', 'Compras', 'Educación',
  'Vivienda', 'Suscripciones', 'Transferencias', 'Ingresos', 'Inversiones', 'Ahorro', 'Préstamos', 'Impuestos', 'Comisiones', 'Otros']);
const serviceType = z.enum(['Luz', 'Agua', 'Gas', 'Internet', 'Telefonía', 'TV', 'Impuestos', 'Otro']);
const insuranceType = z.enum(['Vida', 'Hogar', 'Auto', 'Viaje', 'Salud', 'Celular']);
const t = z.tuple;

export const COMMAND_SCHEMAS = {
  openAccount: t([z.enum(['ahorro', 'corriente', 'nomina']), currency, text(40)]),
  renameAccount: t([id, text(40)]),
  setPrimaryAccount: t([id]),
  closeAccount: t([id]),
  setTxCategory: t([id, category]),
  setTxNote: t([id, text(200)]),
  transferOwn: t([id, id, amount, text(140).optional()]),
  transferToBeneficiary: t([id, id, amount, text(140).optional()]),
  transferByAlias: t([id, text(40), text(80), amount, text(140).optional(), z.boolean().optional()]),
  transferInternational: t([id, z.object({ name: text(80), iban: text(40), swift: text(11), country: text(60), currency, amount, concept: text(140) }).strict()]),
  addBeneficiary: t([z.object({ name: text(80), bank: text(80), accountNumber: text(30), alias: text(40), currency }).strict()]),
  removeBeneficiary: t([id]),
  toggleFavorite: t([id]),
  scheduleTransfer: t([z.object({ fromId: id, beneficiaryId: id, amount, date: day, frequency: z.enum(['unica', 'semanal', 'mensual']), concept: text(140) }).strict()]),
  cancelScheduled: t([id]),
  setTransferLimits: t([amount, amount]),
  requestMoney: t([text(80), amount, text(140)]),
  answerRequest: t([id, z.boolean(), id]),
  createSplit: t([text(140), amount, z.array(text(60)).max(20), z.boolean().optional()]),
  markSplitPaid: t([id, text(60), id]),
  payService: t([id, id, amount.optional()]),
  addService: t([z.object({ company: text(80), type: serviceType, customerNumber: text(40) }).strict()]),
  removeService: t([id]),
  setAutoDebit: t([id, z.boolean(), id.optional()]),
  setReminder: t([id, z.boolean()]),
  mobileTopUp: t([id, text(40), text(20), amount]),
  transportTopUp: t([id, text(20), amount]),
  payTax: t([id, text(60), text(30), amount]),
  payQr: t([id, text(300), amount]),
  setCardStatus: t([id, z.enum(['activa', 'bloqueada'])]),
  reportCard: t([id, z.enum(['robo', 'pérdida', 'daño']), z.boolean()]),
  createVirtualCard: t([id, amount, z.boolean()]),
  changeCardPin: t([id, text(6), text(6), text(6)]),
  setCardLimit: t([id, amount]),
  setCardFlag: t([id, z.enum(['onlineEnabled', 'abroadEnabled']), z.boolean()]),
  setTravelNotice: t([id, text(60), day, day]),
  cardPurchase: t([id, text(80), amount, z.boolean().optional()]),
  payCreditCard: t([id, id, amount]),
  requestLimitIncrease: t([id, amount]),
  createGoal: t([text(60), amount, day, text(8).optional()]),
  contributeGoal: t([id, id, amount]),
  withdrawGoal: t([id, id, amount]),
  deleteGoal: t([id, id]),
  setRoundUp: t([z.boolean(), id.optional()]),
  setBudget: t([category, num.min(0).max(1_000_000)]),
  createFixedDeposit: t([id, amount, z.number().int(), z.boolean()]),
  requestLoan: t([z.enum(['personal', 'hipotecario', 'auto']), amount, z.number().int().min(1).max(480), id]),
  payLoanInstallment: t([id, id]),
  prepayLoan: t([id, id]),
  buyAsset: t([id, text(12), amount]),
  sellAsset: t([id, text(12), amount]),
  setInvestorProfile: t([z.array(z.number().int().min(0).max(10)).max(10)]),
  exchangeCurrency: t([id, id, amount]),
  contractInsurance: t([insuranceType, amount, id]),
  cancelInsurance: t([id]),
  fileClaim: t([id, text(1000)]),
  setPin: t([text(6), text(6)]),
  removePin: t([]),
  setSecurityQuestions: t([z.array(z.object({ question: text(120), answer: text(80) }).strict()).max(6)]),
  revokeDevice: t([id]),
  setEmergencyLock: t([z.boolean(), text(128).optional()]),
  updatePreferences: t([z.object({
    hideBalances: z.boolean(), biometricEnabled: z.boolean(), twoFactor: z.boolean(), quickBalanceWidget: z.boolean(),
    autoLockMinutes: z.number().int(), language: z.enum(['es', 'en']), darkMode: z.enum(['sistema', 'claro', 'oscuro']), displayCurrency: currency,
  }).partial().strict()]),
  setNotificationPref: t([z.enum(['seguridad', 'movimiento', 'pago', 'promo', 'sistema']), z.enum(['push', 'email', 'sms']), z.boolean()]),
  setAlertThreshold: t([z.enum(['lowBalanceThreshold', 'largeTxThreshold']), num]),
  setAvatarColor: t([text(7)]),
  updateProfile: t([z.object({ name: text(80), email: text(120), phone: text(20), address: text(160) }).strict()]),
  markNotification: t([id]),
  deleteNotification: t([id]),
  readMessage: t([id]),
  acceptOffer: t([id]),
  redeemReward: t([id, id]),
  addReferral: t([text(80)]),
  createTicket: t([text(120), text(40), text(2000)]),
  addEmergencyContact: t([text(80), text(20), text(40)]),
  removeEmergencyContact: t([id]),
} satisfies { [K in CommandName]: z.ZodType<CommandArgs<K>> };

/** Valida nombre y argumentos. Lanza ZodError (→ 400) si no coinciden. */
export function parseCommand(body: unknown): { name: CommandName; args: unknown[] } {
  const envelope = z.object({ name: z.string().max(40), args: z.array(z.unknown()).max(10) }).strict().parse(body);
  if (!Object.prototype.hasOwnProperty.call(COMMAND_SCHEMAS, envelope.name)) {
    throw new z.ZodError([{ code: 'custom', path: ['name'], message: 'Comando desconocido', input: envelope.name }]);
  }
  const name = envelope.name as CommandName;
  return { name, args: COMMAND_SCHEMAS[name].parse(envelope.args) as unknown[] };
}
