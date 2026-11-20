/** λ cards-reveal — POST /v1/cards/{cardId}/reveal: número completo y CVV, solo con token OTP válido. */
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { otpCode } from '../../../shared/domain/logic';
import { getDeps } from '../deps';
import { handle, HttpError, identity, json, parseBody, type HttpEvent } from '../http';
import { log } from '../logger';

const Body = z.object({ otp: z.string().regex(/^\d{6}$/) }).strict();
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function route(event: HttpEvent) {
  const customer = identity(event);
  const cardId = event.pathParameters?.cardId ?? '';
  const parsed = Body.safeParse(parseBody(event));
  if (!parsed.success) throw new HttpError(422, 'token_incorrecto');
  const { state } = await getDeps().core.snapshot(customer);
  // Simulación: TOTP derivado del usuario. En producción, validar contra el servicio de OTP del banco.
  if (!same(parsed.data.otp, otpCode(state.user.username))) throw new HttpError(422, 'token_incorrecto');
  const card = state.cards.find((c) => c.id === cardId && c.status !== 'cancelada');
  if (!card) throw new HttpError(404, 'tarjeta_no_existe');
  log('info', 'card_revealed', { cardId, requestId: event.requestContext?.requestId }); // auditoría, sin datos de la tarjeta
  return json(200, { number: card.number, cvv: card.cvv });
}

export const handler = handle('cards-reveal', route);
