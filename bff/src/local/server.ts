/**
 * Servidor de DESARROLLO que emula API Gateway (HTTP API + autorizador JWT) y llama a los mismos
 * handlers que las Lambdas. Datos en memoria e identidad local (usuarios demo/demo1234 y ana/ana12345).
 *   npm run dev   →   http://localhost:4000
 */
process.env.BFF_ENV = 'local';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { DOMAINS, type Domain } from '../../../shared/domain/commands';
import { verifyLocalToken } from '../auth/local';
import { route as authRoute } from '../handlers/auth';
import { route as revealRoute } from '../handlers/cardsReveal';
import { commandsRoute } from '../handlers/commands';
import { route as meRoute } from '../handlers/me';
import { handler as daily } from '../handlers/scheduler';
import { handle, type HttpEvent, type Result } from '../http';

const PORT = Number(process.env.PORT ?? 4000);
const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)(:\d+)?$/;

type Route = { method: string; pattern: RegExp; key: (m: RegExpMatchArray) => string; auth: boolean; run: (e: HttpEvent, m: RegExpMatchArray) => Promise<Result> };
const ROUTES: Route[] = [
  { method: 'POST', pattern: /^\/v1\/auth\/(login|refresh)$/, key: (m) => `POST /v1/auth/${m[1]}`, auth: false, run: (e) => handle('auth', authRoute)(e) },
  { method: 'POST', pattern: /^\/v1\/auth\/password$/, key: () => 'POST /v1/auth/password', auth: true, run: (e) => handle('auth', authRoute)(e) },
  { method: 'GET', pattern: /^\/v1\/me$/, key: () => 'GET /v1/me', auth: true, run: (e) => handle('me', meRoute)(e) },
  { method: 'POST', pattern: /^\/v1\/cards\/([^/]+)\/reveal$/, key: () => 'POST /v1/cards/{cardId}/reveal', auth: true, run: (e) => handle('cards-reveal', revealRoute)(e) },
  { method: 'POST', pattern: /^\/v1\/([a-z]+)\/commands$/, key: (m) => `POST /v1/${m[1]}/commands`, auth: true,
    run: (e, m) => handle(`commands:${m[1]}`, commandsRoute(m[1] as Domain))(e) },
];

const readBody = (req: IncomingMessage) => new Promise<string>((resolve, reject) => {
  let data = ''; req.on('data', (c) => { data += c; if (data.length > 64 * 1024) req.destroy(); }); req.on('end', () => resolve(data)); req.on('error', reject);
});

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const path = (req.url ?? '/').split('?')[0];
  if (req.method === 'POST' && path === '/dev/daily') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await daily())); return; }

  const match = ROUTES.map((r) => ({ r, m: req.method === r.method ? path.match(r.pattern) : null })).find((x) => x.m);
  if (!match) { res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'solicitud_invalida', params: {} } })); return; }
  const { r, m } = match as { r: Route; m: RegExpMatchArray };
  if (r.key(m).includes('/commands') && !DOMAINS.includes(m[1] as Domain)) { res.writeHead(404).end(); return; }

  // Autorizador JWT (en AWS lo hace API Gateway con Cognito).
  let claims: Record<string, string | number | boolean> | null = null;
  if (r.auth) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    claims = token ? await verifyLocalToken(token) : null;
    if (!claims) { res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Unauthorized' })); return; }
  }
  const body = req.method === 'POST' ? await readBody(req) : undefined;
  const event = {
    version: '2.0', routeKey: r.key(m), rawPath: path, rawQueryString: '', isBase64Encoded: false, body,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : v ?? ''])),
    pathParameters: r.key(m).includes('{cardId}') ? { cardId: decodeURIComponent(m[1]) } : undefined,
    requestContext: { requestId: randomUUID(), routeKey: r.key(m), ...(claims ? { authorizer: { jwt: { claims, scopes: [] } } } : {}) },
  } as unknown as HttpEvent;
  const out = (await r.run(event, m)) as { statusCode: number; headers?: Record<string, string>; body?: string };
  res.writeHead(out.statusCode, out.headers ?? {}).end(out.body ?? '');
}).listen(PORT, () => console.log(`BFF local en http://localhost:${PORT} (usuarios: demo/demo1234, ana/ana12345)`));
