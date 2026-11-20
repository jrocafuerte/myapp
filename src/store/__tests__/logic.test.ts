/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as L from '../logic';
import { createSeed } from '../seed';

const s0 = () => createSeed();
const bal = (s: ReturnType<typeof createSeed>, id: string) => s.accounts.find((a) => a.id === id)!.balance;

test('login correcto e incorrecto queda registrado', () => {
  const ok = L.login(s0(), 'demo', 'demo1234');
  assert.equal(ok.ok, true);
  const bad = L.login(s0(), 'demo', 'x');
  assert.equal(bad.ok, false);
  assert.equal(bad.state.loginHistory[0].success, false);
});

test('transferencia propia con conversión de moneda', () => {
  const s = L.transferOwn(s0(), 'acc-1', 'acc-3', 108);
  assert.equal(bal(s, 'acc-1'), 4820.35 - 108);
  assert.ok(bal(s, 'acc-3') > 820 && bal(s, 'acc-3') < 920);
});

test('no permite saldo insuficiente ni superar límites', () => {
  assert.throws(() => L.transferToBeneficiary(s0(), 'acc-1', 'ben-1', 999999), /límite|Saldo/);
  assert.throws(() => L.transferToBeneficiary(s0(), 'acc-1', 'ben-1', 3000), /límite por operación/);
  let s = L.transferToBeneficiary(s0(), 'acc-2', 'ben-1', 2500);
  s = L.transferToBeneficiary(s, 'acc-2', 'ben-1', 2500);
  assert.throws(() => L.transferToBeneficiary(s, 'acc-2', 'ben-1', 1), /límite diario/);
});

test('bloqueo de emergencia impide débitos y bloquea tarjetas', () => {
  const s = L.setEmergencyLock(s0(), true);
  assert.ok(s.cards.every((c) => c.status === 'bloqueada'));
  assert.throws(() => L.payService(s, 'srv-1', 'acc-1'), /bloqueada/);
  assert.throws(() => L.setEmergencyLock(s, false, 'mala'), /incorrecta/);
  assert.equal(L.setEmergencyLock(s, false, 'demo1234').user.emergencyLocked, false);
});

test('pago de servicio deja la deuda en cero', () => {
  const s = L.payService(s0(), 'srv-1', 'acc-1');
  assert.equal(s.services.find((x) => x.id === 'srv-1')!.amountDue, 0);
});

test('redondeo automático aporta a la meta', () => {
  let s = L.setRoundUp(s0(), true, 'goal-1');
  s = L.payQr(s, 'acc-1', 'COMERCIO-CAFE01', 4.3);
  assert.equal(s.goals.find((g) => g.id === 'goal-1')!.saved, 1250.7);
});

test('préstamo: simulación francesa y cancelación por cuotas', () => {
  const sim = L.loanSimulation(1200, 12, 12);
  assert.equal(sim.schedule.at(-1)!.balance, 0);
  let s = L.requestLoan(s0(), 'personal', 1200, 12, 'acc-1');
  const id = s.loans.at(-1)!.id;
  for (let i = 0; i < 12; i++) s = L.payLoanInstallment(s, id, 'acc-1');
  assert.equal(s.loans.at(-1)!.status, 'cancelado');
});

test('inversiones: perfil requerido para alto riesgo, compra y venta', () => {
  assert.throws(() => L.buyAsset(s0(), 'acc-1', 'TSLA', 100), /perfil/);
  let s = L.setInvestorProfile(s0(), [2, 2, 2, 2, 2]);
  s = L.buyAsset(s, 'acc-1', 'TSLA', 100);
  const h = s.holdings.find((x) => x.symbol === 'TSLA')!;
  s = L.sellAsset(s, 'acc-1', 'TSLA', h.qty);
  assert.ok(!s.holdings.some((x) => x.symbol === 'TSLA'));
});

test('tarjetas: número virtual válido por Luhn y tarjeta de un uso se cancela', () => {
  let s = L.createVirtualCard(s0(), 'acc-1', 100, true);
  const c = s.cards.at(-1)!;
  assert.ok(L.isLuhnValid(c.number));
  s = L.cardPurchase(s, c.id, 'Tienda', 20, true);
  assert.equal(s.cards.at(-1)!.status, 'cancelada');
});

test('transferencia internacional valida SWIFT e IBAN', () => {
  assert.throws(() => L.transferInternational(s0(), 'acc-1', { name: 'Juan', iban: 'XX', swift: 'ABC', country: 'ES', currency: 'EUR', amount: 100, concept: 'Pago' }), /SWIFT/);
  const s = L.transferInternational(s0(), 'acc-1', { name: 'Juan Pérez', iban: 'ES9121000418450200051332', swift: 'CAIXESBBXXX', country: 'España', currency: 'EUR', amount: 100, concept: 'Pago factura' });
  assert.ok(bal(s, 'acc-1') < 4820.35 - 100);
});

test('cerrar cuenta exige saldo cero', () => {
  assert.throws(() => L.closeAccount(s0(), 'acc-3'), /saldo cero/);
  let s = L.openAccount(s0(), 'ahorro', 'GBP', 'Libras');
  const id = s.accounts.at(-1)!.id;
  s = L.closeAccount(s, id);
  assert.equal(s.accounts.at(-1)!.closed, true);
});

test('OTP es estable dentro de la ventana de 30 s', () => {
  assert.equal(L.otpCode('demo', 60000), L.otpCode('demo', 89999));
  assert.match(L.otpCode('demo'), /^\d{6}$/);
});

test('detecta gastos recurrentes del seed', () => {
  const r = L.detectRecurring(s0()).map((x) => x.description);
  assert.ok(r.includes('Netflix') && r.includes('Spotify'));
});
