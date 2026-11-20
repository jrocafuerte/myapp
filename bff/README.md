# BFF de Banco Plus

Backend for Frontend **serverless** en AWS: **Node.js + TypeScript**, infraestructura con **AWS CDK**, **API Gateway (HTTP API)** y **Lambda**. Es la única puerta de la app (y del micro frontend) hacia los servicios del banco.

```
App móvil / web ── HTTPS + JWT ──▶ API Gateway (HTTP API)
                                    │  autorizador JWT (Cognito) · límites de tráfico · logs de acceso
                                    ├─ λ Auth           POST /v1/auth/login · /v1/auth/refresh · /v1/auth/password
                                    ├─ λ Me             GET  /v1/me                      vista del cliente, sin secretos
                                    ├─ λ Commands × 9   POST /v1/{dominio}/commands      una Lambda por dominio, idempotente
                                    ├─ λ CardsReveal    POST /v1/cards/{cardId}/reveal   número completo y CVV con OTP
                                    └─ λ Scheduler      EventBridge diario               programadas, débitos, plazos fijos
                                                │
                                         puertos por dominio (src/core/port.ts)
                                                │
                     hoy: adaptador simulado (DynamoDB + la lógica de shared/domain)
                     después: adaptadores a las APIs reales del banco, dominio por dominio
```

Dominios (una Lambda cada uno): `accounts`, `transfers`, `payments`, `cards`, `savings`, `loans`, `investments`, `insurance`, `profile`.

## Contrato con la app

- **Comandos** (`shared/domain/commands.ts`): 75 operaciones con nombre y argumentos tipados, por ejemplo `{ "name": "transferOwn", "args": ["acc-1", "acc-2", 100, "Ahorro"] }`. Cada uno tiene un esquema zod (`src/commands/schemas.ts`) que el compilador compara con la firma de la función de negocio.
- **Respuesta exitosa**: `200 { state, version }`, con el estado del cliente ya actualizado y sin secretos.
- **Errores**: `{ error: { code, params } }`, con los mismos códigos que muestra la app (`shared/domain/messages.ts`). La configuración remota puede cambiar sus textos.

| Estado | Cuándo |
|---|---|
| 400 `solicitud_invalida` | JSON inválido, comando desconocido, tipos incorrectos, falta `Idempotency-Key` |
| 401 | Sin token o vencido (API Gateway); credenciales incorrectas en login |
| 404 | Comando de otro dominio, tarjeta inexistente |
| 409 `operacion_en_curso` | La misma operación todavía se está procesando |
| 422 `<código>` | Regla de negocio (`saldo_insuficiente`, `supera_limite_diario_usd`…) o misma clave de idempotencia con otro contenido |
| 500 `error_inesperado` | Error no previsto (se registra en logs) |

## Seguridad

- **Identidad:** Amazon Cognito. El BFF intermedia el login (la app no necesita el SDK de AWS) y API Gateway valida el JWT en todas las rutas salvo login y refresh. Tokens de acceso de 15 minutos; en el teléfono se guardan en el llavero/Keystore con `expo-secure-store`.
- **Datos sensibles:** la contraseña, los PIN, las respuestas de seguridad, el CVV y el número completo de tarjeta nunca salen del servidor (`toClientState`). Para ver los datos de la tarjeta hace falta un OTP, la consulta queda auditada y la ruta tiene un límite de tráfico estricto.
- **Validación en dos capas:** esquema estricto por comando (zod, sin campos extra) y después las reglas de negocio.
- **Idempotencia:** cada comando exige `Idempotency-Key`. Un reintento de red devuelve la misma respuesta sin ejecutar dos veces; una clave reutilizada con otro contenido se rechaza. Se guardan 24 h.
- **Concurrencia:** control optimista por versión en DynamoDB, con reintento automático.
- **Mínimo privilegio:** cada Lambda solo accede a la tabla; la de un dominio solo acepta comandos de su dominio.
- **Límites:** 100 req/s por defecto, 10 req/s en login y 5 req/s en datos de tarjeta.
- **Observabilidad:** logs JSON sin datos personales, logs de acceso de API Gateway y trazas X-Ray.

## Desarrollo local (sin AWS)

```bash
cd bff && npm install
npm run dev          # http://localhost:4000 · usuarios demo/demo1234 y ana/ana12345
```

El servidor local emula API Gateway y su autorizador JWT, y llama a **los mismos handlers** que las Lambdas, con datos en memoria. En otra terminal, abre la app apuntando a él:

```bash
EXPO_PUBLIC_BFF_URL=http://localhost:4000 npx expo start
```

Para disparar los procesos diarios a mano: `curl -X POST http://localhost:4000/dev/daily`.

Sin `EXPO_PUBLIC_BFF_URL` la app funciona en **modo local**: la lógica corre en el teléfono con datos de demostración, sin servidor.

## Tests

```bash
npm test             # handlers (auth, idempotencia, concurrencia, secretos, reglas) + infraestructura (CDK assertions)
npm run typecheck
```

## Despliegue en AWS

Requisitos: credenciales de AWS configuradas y la cuenta/región con *bootstrap* de CDK.

```bash
cd bff
npx cdk bootstrap                                                       # una vez por cuenta/región
npx cdk deploy -c stage=dev -c allowedOrigins=https://app.tu-dominio.com
```

- `stage=prod` activa la protección contra borrado de la tabla y del User Pool, y retiene los logs 1 año.
- `allowedOrigins`: dominios de la **app web** para CORS (iOS y Android no lo necesitan).
- Salidas: `ApiUrl` (va en `EXPO_PUBLIC_BFF_URL` de la app), `UserPoolId`, `UserPoolClientId` y `TableName`.

Los clientes se dan de alta en Cognito (el autoregistro está desactivado). Por ejemplo:

```bash
aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username cliente1 --user-attributes Name=email,Value=cliente1@ejemplo.com
```

En el primer acceso, el adaptador simulado le crea una cartera de demostración.

## Integrar los servicios reales del banco

El BFF depende de **puertos** (`src/core/port.ts`), no de sistemas concretos. Para pasar un dominio a su API real:

1. Crea `src/core/<dominio>.ts` implementando `DomainAdapter`: recibe el cliente y el comando y llama a la API del banco (REST, SOAP vía un cliente, colas…). Para respetar los mensajes de la app, traduce sus errores a `BankError('<código>')`.
2. Regístralo en `REAL_ADAPTERS` (`src/core/index.ts`). Los demás dominios siguen en el simulado.
3. Haz que la parte del `snapshot` de ese dominio se lea del servicio real (`SnapshotProvider`), y dale a esa Lambda los permisos y la red que necesite: VPC, secretos en Secrets Manager, etc.

Así la migración es gradual y la app no cambia: sigue enviando los mismos comandos.

## Pendiente para producción

- **APIs reales del banco:** hoy todo usa el adaptador simulado.
- **OTP real:** el token actual es una simulación derivada del usuario. Debe validarse contra el servicio de OTP del banco o con TOTP real (RFC 6238).
- **MFA de Cognito y desafíos de login:** el User Pool permite TOTP, pero el BFF todavía no resuelve los desafíos (MFA, contraseña nueva). Por ahora se responden como credenciales inválidas.
- **PIN y biometría con BFF:** necesitan vincular el dispositivo con el servidor. En modo BFF la app solo ofrece usuario y contraseña.
- **AWS WAF** frente a API Gateway, **dominio propio** con certificado, y **alarmas** de CloudWatch (5xx, latencia, throttling).
- **Tamaño del estado simulado:** se guarda como un único ítem de DynamoDB (máximo 400 KB). Alcanza para la demo; los servicios reales no tienen ese límite.
- **Dependencias:** `npm audit` reporta una vulnerabilidad moderada en `minimatch`, incluida dentro de `aws-cdk-lib`. Solo se usa al sintetizar en tu máquina o CI, no en las Lambdas. Conviene actualizar `aws-cdk-lib` cuando salga la versión corregida.
