# Micro frontend: Pago de servicios

App **Next.js 16 + React 19** independiente que implementa el módulo de Pago de servicios de Banco Plus y se **incrusta en la app móvil** (WebView en iOS/Android, iframe en la versión web) con aspecto y comportamiento nativos.

Funcionalidades que cubre (siguen contando dentro de las 117 de la app):

| Funcionalidad | Ruta |
|---|---|
| Pago de servicios | `/` y `/pagar/?id=…` (confirmación y comprobante) |
| Servicios adheridos | `/servicios/` |
| Débito automático | `/debito-automatico/` |
| Recordatorios de vencimiento | `/vencimientos/` |
| Historial de pagos | `/historial/` |

## Cómo funciona

```
App nativa (host)                                   Micro frontend (Next.js)
─────────────────                                   ────────────────────────
PagosServiciosMFE ── abre URL ?embed&theme&v ──▶   carga y envía  ready
                  ◀──────────── ready ──────────
                  ──── init { contexto } ───────▶   aplica tema y dibuja
usuario toca "Pagar"                                request { payService }
                  ◀──────── request ────────────
logic.ts valida y ejecuta (misma lógica que las pantallas nativas)
                  ──── response { comprobante } ▶   muestra el comprobante
                  ──── context { nuevos datos } ▶   actualiza saldos y listas
```

- **La app es la única fuente de verdad.** El micro frontend no guarda datos ni reglas de negocio: muestra el contexto que recibe y pide operaciones. Bloqueo de emergencia, saldo insuficiente, validaciones: todo lo decide `src/store/logic.ts`.
- **Contrato tipado y versionado** en `shared/pagos-mfe/protocol.ts`, usado por ambos lados. Cada mensaje se valida en tiempo de ejecución (`parseHostMessage` / `parseMfeMessage`); lo que no cumple el contrato se descarta.
- **Despliegue independiente.** `npm run build` genera HTML estático en `out/`, que se publica en cualquier CDN o servidor. La app solo necesita su URL.

## Comportamiento nativo

| Aspecto | Cómo |
|---|---|
| Aspecto idéntico | La app envía los tokens de su design system (colores, espaciado, radios, tipografía) y se aplican como variables CSS. Si cambias de librería de design system, el micro frontend sigue el cambio. |
| Sin destello al abrir | El tema llega en la URL (`?theme=dark`) y se aplica antes de pintar; la WebView usa el color de fondo del tema. Mientras conecta se ve una pantalla de carga nativa. |
| Barra de título nativa | Cada pantalla envía su título (`title`) y la app lo pone en su barra. |
| Botón atrás | En Android la app reenvía el botón atrás (`back`): el micro frontend navega hacia atrás dentro de su pila y, en su raíz, pide cerrar (`close`). |
| Vibración y compartir | Se piden a la app (`haptic`, `share`), que usa las APIs nativas. |
| Gestos y zoom | Sin zoom, sin rebote, sin selección de texto (salvo en campos y datos), sin resaltado al tocar y sin demora de 300 ms. |
| Transiciones | Animación de entrada entre pantallas; se desactiva con "reducir movimiento". |
| Errores | Si no carga o no responde en 15 s, la app muestra un estado de error nativo con "Reintentar". |
| Accesibilidad | Roles de interruptor, radio y alerta; foco al título de cada pantalla; objetivos táctiles de 44 px. |

## Seguridad

- La WebView solo navega al origen del micro frontend (`originWhitelist` y `onShouldStartLoadWithRequest`); otros enlaces se abren fuera de la app. Solo acepta mensajes de ese origen.
- En web, el micro frontend solo habla con los orígenes de `NEXT_PUBLIC_HOST_ORIGINS`, y la app solo acepta mensajes del iframe y origen esperados.
- Abierto directamente en un navegador, en producción, no muestra datos ni funciona: necesita a la app.
- No viajan tokens ni credenciales: la sesión vive en la app. En producción, publícalo **solo por HTTPS**.

## Desarrollo

```bash
cd mfe/pagos-servicios
npm install
npm run dev        # http://localhost:3001 con datos de ejemplo (modo independiente)
```

En otra terminal, desde la raíz del repositorio, abre la app apuntando a esa URL:

```bash
EXPO_PUBLIC_PAGOS_MFE_URL=http://localhost:3001 npx expo start
```

- **Emulador de Android:** usa `http://10.0.2.2:3001` (el `localhost` del emulador no es tu computadora).
- **Teléfono físico:** usa la IP de tu computadora en la red local, por ejemplo `http://192.168.1.20:3001`.
- Los builds de producción de Android e iOS bloquean `http://`; publica el micro frontend con HTTPS.

## Producción

```bash
npm run build      # genera out/
npm start          # sirve out/ en el puerto 3001 para probarlo
```

Publica `out/` (Vercel, Netlify, S3 + CloudFront, Nginx…) y configura en la app:

```bash
EXPO_PUBLIC_PAGOS_MFE_URL=https://pagos.tu-dominio.com
```

Si la app web se publica en otro dominio, agrégalo al compilar el micro frontend:

```bash
NEXT_PUBLIC_HOST_ORIGINS=https://app.tu-dominio.com npm run build
```

## Cambiar el contrato

1. Edita `shared/pagos-mfe/protocol.ts` (tipos y validadores).
2. Un cambio incompatible sube `VERSION`; los dos lados ignoran mensajes de otra versión. Publica el micro frontend nuevo antes de la app que lo usa, o mantiene compatibilidad con la versión anterior.
3. `npm test` en la raíz prueba el contrato y la capa del host (`src/features/mfe/pagosHost.ts`).

## Estructura

```
mfe/pagos-servicios/
├── app/                    rutas (App Router): /, pagar, servicios, debito-automatico, vencimientos, historial
├── components/ui.tsx       componentes con aspecto nativo
├── components/Gate.tsx     carga / sin app / listo
├── lib/bridge.ts           transporte: WebView, iframe o independiente
├── lib/BridgeProvider.tsx  contexto, operaciones, título, atrás, tema
└── lib/mockHost.ts         host simulado solo para `npm run dev`
shared/pagos-mfe/protocol.ts            contrato compartido
src/features/mfe/PagosServiciosMFE.tsx  pantalla de la app que lo aloja
src/features/mfe/EmbeddedView(.web).tsx WebView nativa / iframe web
src/features/mfe/pagosHost.ts           contexto y operaciones del lado de la app
```
