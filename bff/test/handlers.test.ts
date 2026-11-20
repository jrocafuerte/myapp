/// <reference types="node" />
process.env.BFF_ENV = 'local';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { otpCode } from '../../shared/domain/logic';
import type { BankState } from '../../shared/domain/types';
import { LocalAuth } from '../src/auth/local';
import { SimulatedCore } from '../src/core/simulated';
import { setDeps } from '../src/deps';
import { route as authRoute } from '../src/handlers/auth';
import { route as revealRoute } from '../src/handlers/cardsReveal';
import { commandsRoute } from '../src/handlers/commands';
import { route as meRoute } from '../src/handlers/me';
import { handler as daily } from '../src/handlers/scheduler';
import { handle, type HttpEvent } from '../src/http';
import { MemoryStore } from '../src/store/memory';

const DEMO = { sub: 'local-demo', username: 'demo' };
let store: MemoryStore;
beforeEach(() => { store = new MemoryStore(); const auth = new LocalAuth(); setDeps({ store, auth, core: new SimulatedCore(store, auth) }); });

const ev = (o: { routeKey?: string; body?: unknown; claims?: object | null; headers?: Record<string, string>; cardId?: string }): HttpEvent => ({
  routeKey: o.routeKey ?? 'X', rawPath: '/', headers: o.headers ?? {}, isBase64Encoded: false,
  body: o.body === undefined ? undefined : JSON.stringify(o.body),
  pathParameters: o.cardId ? { cardId: o.cardId } : undefined,
  requestContext: { requestId: 'test', ...(o.claims === null ? {} : { authorizer: { jwt: { claims: o.claims ?? DEMO } } }) },
}) as unknown as HttpEvent;
type R = { statusCode: number; body: string; headers?: Record<string, string> };
const call = async (h: (e: HttpEvent) => Promise<unknown>, e: HttpEvent) => { const r = (await h(e)) as R; return { status: r.statusCode, body: JSON.parse(r.body || 'null'), headers: r.headers ?? {} }; };
const me = (claims?: object | null) => call(handle('me', meRoute), ev({ claims }));
const command = (domain: Parameters<typeof commandsRoute>[0], name: string, args: unknown[], key = `k-${Math.random().toString(36).slice(2)}-0000000000`) =>
  call(handle('cmd', commandsRoute(domain)), ev({ body: { name, args }, headers: { 'idempotency-key': key } }));
const balance = (s: BankState, id: string) => s.accounts.find((a) => a.id === id)!.balance;

test('login: credenciales inválidas → 401 con código; válidas → tokens', async () => {
  const bad = await call(handle('auth', authRoute), ev({ routeKey: 'POST /v1/auth/login', body: { username: 'demo', password: 'x' }, claims: null }));
  assert.equal(bad.status, 401); assert.equal(bad.body.error.code, 'credenciales_invalidas');
  const ok = await call(handle('auth', authRoute), ev({ routeKey: 'POST /v1/auth/login', body: { username: 'DEMO', password: 'demo1234' }, claims: null }));
  assert.equal(ok.status, 200); assert.ok(ok.body.accessToken && ok.body.refreshToken);
  const refreshed = await call(handle('auth', authRoute), ev({ routeKey: 'POST /v1/auth/refresh', body: { refreshToken: ok.body.refreshToken }, claims: null }));
  assert.equal(refreshed.status, 200); assert.ok(refreshed.body.accessToken);
});

test('GET /v1/me exige identidad y no expone secretos', async () => {
  assert.equal((await me(null)).status, 401);
  const r = await me();
  assert.equal(r.status, 200); assert.equal(r.body.version, 1);
  const s = r.body.state as BankState;
  assert.equal(s.user.username, 'demo');
  assert.equal(s.user.password, '');
  assert.ok(s.cards.every((c) => c.cvv === '' && c.pin === '' && c.number.startsWith('000000000000')));
});

test('comando válido: ejecuta con la lógica del banco y devuelve el estado nuevo', async () => {
  const r = await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 100, 'Ahorro']);
  assert.equal(r.status, 200);
  assert.equal(balance(r.body.state, 'acc-1'), 4720.35);
  assert.equal(r.body.version, 2);
});

test('validación: sin clave de idempotencia, comando desconocido, de otro dominio o con tipos inválidos', async () => {
  const noKey = await call(handle('cmd', commandsRoute('transfers')), ev({ body: { name: 'transferOwn', args: ['acc-1', 'acc-2', 1] } }));
  assert.equal(noKey.status, 400);
  assert.equal((await command('transfers', 'borrarTodo', [])).status, 400);
  assert.equal((await command('payments', 'transferOwn', ['acc-1', 'acc-2', 1])).status, 404);
  assert.equal((await command('transfers', 'transferOwn', ['acc-1', 'acc-2', '100'])).status, 400);
  assert.equal((await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 1, 'x', 'extra'])).status, 400);
  assert.equal((await command('profile', 'updatePreferences', [{ isAdmin: true }])).status, 400);
});

test('regla de negocio: 422 con el mismo código y variables que usa la app', async () => {
  const r = await command('transfers', 'transferToBeneficiary', ['acc-1', 'ben-1', 3000]);
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.error, { code: 'supera_limite_operacion_usd', params: { limit: 2500 } });
});

test('idempotencia: un reintento no ejecuta dos veces; la misma clave con otro cuerpo se rechaza', async () => {
  const key = 'reintento-de-red-123456';
  const a = await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 50], key);
  const b = await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 50], key);
  assert.equal(b.headers['Idempotent-Replayed'], 'true');
  assert.deepEqual(b.body, a.body);
  assert.equal(balance((await me()).body.state, 'acc-1'), 4770.35); // una sola vez
  assert.equal((await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 99], key)).status, 422);
});

test('concurrencia: dos operaciones simultáneas se aplican ambas (reintento sobre la versión nueva)', async () => {
  await me();
  await Promise.all([command('transfers', 'transferOwn', ['acc-1', 'acc-2', 10]), command('transfers', 'transferOwn', ['acc-1', 'acc-2', 20])]);
  const s = (await me()).body.state;
  assert.equal(balance(s, 'acc-1'), 4790.35);
  assert.equal(balance(s, 'acc-2'), 12680);
});

test('bloqueo de emergencia: se levanta solo con la contraseña real del proveedor de identidad', async () => {
  assert.equal((await command('profile', 'setEmergencyLock', [true])).status, 200);
  assert.equal((await command('payments', 'payService', ['srv-1', 'acc-1'])).body.error.code, 'cuenta_esta_bloqueada_emergencia');
  assert.equal((await command('profile', 'setEmergencyLock', [false, 'mala'])).body.error.code, 'contrasena_incorrecta');
  assert.equal((await command('profile', 'setEmergencyLock', [false, 'demo1234'])).status, 200);
});

test('datos completos de tarjeta: solo con OTP válido', async () => {
  const r = handle('reveal', revealRoute);
  assert.equal((await call(r, ev({ body: { otp: '000000' }, cardId: 'card-1' }))).body.error.code, 'token_incorrecto');
  const ok = await call(r, ev({ body: { otp: otpCode('demo') }, cardId: 'card-1' }));
  assert.equal(ok.status, 200);
  assert.match(ok.body.number, /^\d{16}$/); assert.match(ok.body.cvv, /^\d{3}$/);
  assert.equal((await call(r, ev({ body: { otp: otpCode('demo') }, cardId: 'no-existe' }))).status, 404);
});

test('cambio de contraseña: reglas del dominio y luego el proveedor de identidad', async () => {
  const login = await call(handle('auth', authRoute), ev({ routeKey: 'POST /v1/auth/login', body: { username: 'demo', password: 'demo1234' }, claims: null }));
  const pw = (body: object) => call(handle('auth', authRoute), ev({ routeKey: 'POST /v1/auth/password', body, headers: { authorization: `Bearer ${login.body.accessToken}` } }));
  assert.equal((await pw({ current: 'demo1234', next: 'corta', confirm: 'corta' })).body.error.code, 'nueva_contrasena_debe_tener');
  assert.equal((await pw({ current: 'mala1234', next: 'nueva1234', confirm: 'nueva1234' })).body.error.code, 'contrasena_actual_incorrecta');
  assert.equal((await pw({ current: 'demo1234', next: 'nueva1234', confirm: 'nueva1234' })).status, 200);
});

test('cada cliente tiene sus propios datos', async () => {
  await command('transfers', 'transferOwn', ['acc-1', 'acc-2', 100]);
  const ana = await me({ sub: 'local-ana', username: 'ana' });
  assert.equal(balance(ana.body.state, 'acc-1'), 4820.35);
  assert.equal(ana.body.state.user.username, 'ana');
});

test('proceso diario: recorre a todos los clientes', async () => {
  await me(); await me({ sub: 'local-ana', username: 'ana' });
  const r = await daily();
  assert.deepEqual(r, { processed: 2, failed: 0 });
});
