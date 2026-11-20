# Configuración remota

Permite cambiar **mensajes de error, nombres de menú y pantallas de mantenimiento sin publicar una versión nueva de la app**. Es un archivo JSON publicado en un servidor HTTPS; la app lo descarga al abrirse, al volver al primer plano y cada 5 minutos.

## Qué se puede cambiar

| Sección | Qué cambia | Ejemplo |
|---|---|---|
| `messages` | Texto de cualquiera de los 122 mensajes de error, por código | `"saldo_insuficiente": "No te alcanza en {alias}."` |
| `texts` | Textos de interfaz: pestañas y encabezados | `"payments": "Pagar y transferir"` |
| `features` | Nombre, descripción u ocultar cada una de las 117 funcionalidades | `"pay-services": { "title": "Pagar cuentas" }` |
| `modules` | Nombre u ocultar un módulo entero del menú | `"seguros": { "hidden": true }` |
| `maintenance` | Pantallas de mantenimiento: toda la app, un módulo o una funcionalidad, con horario opcional | ver abajo |

Los códigos, ids y claves disponibles están en **[CATALOGO.md](CATALOGO.md)**. El ejemplo completo está en [config.example.json](config.example.json).

## Mantenimiento

```json
"maintenance": [
  { "scope": "app", "title": "Volvemos en un rato", "message": "Estamos en mantenimiento programado." },
  { "scope": "module:inversiones", "message": "Mercado cerrado por actualización.", "from": "2026-11-23T02:00:00-05:00", "until": "2026-11-23T06:00:00-05:00" },
  { "scope": "feature:pay-services", "title": "Pagos en pausa", "message": "Actualizando el sistema de pagos." }
]
```

- `scope`: `app` reemplaza **todas** las pantallas, incluido el acceso. `module:<id>` y `feature:<id>` bloquean solo esa parte; el resto de la app sigue funcionando y el menú la marca "En mantenimiento".
- `from` / `until` (opcionales, ISO 8601 con zona horaria): la pantalla aparece y desaparece sola en ese horario, sin volver a publicar. `until` se muestra como "Volvemos aprox. el …".
- La pantalla tiene **Reintentar**, que vuelve a descargar la configuración: al levantar el mantenimiento, el usuario vuelve a la app sin cerrarla.

## Cómo publicar un cambio

1. Edita una copia del JSON y cambia `revision` (por ejemplo `2026-11-21.1`) para identificar la versión.
2. Valídalo:
   ```bash
   npm run config:validate -- ruta/al/config.json
   ```
   Marca códigos o ids que no existen, variables mal usadas (`{cuenta}` donde solo existe `{alias}`) y fechas inválidas.
3. Súbelo a la URL configurada. Los usuarios lo reciben en minutos: al abrir la app, al volver a ella o en la siguiente actualización periódica.

Para deshacer, vuelve a publicar la versión anterior (o `{ "schemaVersion": 1 }` para volver a los textos de fábrica).

## Dónde publicarlo

Cualquier URL HTTPS que devuelva el JSON: S3 + CloudFront, Firebase Hosting, Netlify, GitHub Pages, un endpoint de tu API… La app la lee de `EXPO_PUBLIC_REMOTE_CONFIG_URL` (ver `.env.example`).

- Configura una caché corta (por ejemplo `Cache-Control: max-age=60`) para que los cambios lleguen rápido.
- Para la **versión web** de la app, el servidor debe permitir CORS desde el dominio de la app (`Access-Control-Allow-Origin`). iOS y Android no lo necesitan.
- Sin URL configurada, la app usa sus textos de fábrica y no muestra mantenimiento.

## Qué pasa si algo falla

| Situación | Comportamiento |
|---|---|
| Sin conexión o el servidor no responde (6 s) | Usa la última configuración válida guardada en el dispositivo |
| JSON inválido, otra `schemaVersion` o más de 256 KB | Se ignora el archivo completo; sigue con la última válida |
| Una entrada inválida (código inexistente, variable no permitida) | Se descarta solo esa entrada; el resto se aplica |
| Primera apertura sin red | Textos de fábrica |

La app **nunca espera a la red para abrir**: arranca con lo guardado y se actualiza cuando llega la versión nueva.

## Seguridad

- La configuración solo admite **texto plano y banderas**: no ejecuta código, no carga URLs ni HTML, y cada texto tiene un largo máximo.
- Quien pueda escribir en esa URL puede cambiar textos y poner la app en mantenimiento: protege el acceso al servidor (permisos, historial de cambios, revisión antes de publicar).
- Siguiente paso recomendado para producción: **firmar el JSON** (por ejemplo con Ed25519) y verificar la firma en la app con la clave pública, así un servidor comprometido no puede publicar una configuración falsa.

## Alcance

- Pago de servicios es un micro frontend: sus textos se cambian publicando una nueva versión del micro frontend, que tampoco requiere publicar la app. El mantenimiento de sus 5 funcionalidades sí se controla desde aquí (`feature:pay-services`, `module:pagos`, etc.).
- Para cambios mayores de la app (pantallas nuevas, lógica), Expo ofrece **EAS Update**, que publica una versión nueva del código JavaScript sin pasar por las tiendas. Requiere una cuenta de Expo y configurar `expo-updates`; no está activado en este proyecto.

## Para desarrolladores

- Mensajes: `src/remote-config/messages.ts` (catálogo de códigos y textos de fábrica). La lógica lanza `BankError('código', { variables })`; la app traduce al mostrar.
- Esquema y validación: `src/remote-config/schema.ts`. Descarga: `fetch.ts`. Proveedor y hooks (`useMessage`, `useMaintenance`, `useRemoteConfig`): `RemoteConfigProvider.tsx`.
- Menú: `useCatalog()` en `src/features/registry.ts` aplica nombres, ocultos y mantenimiento.
- Al agregar un mensaje, funcionalidad o texto, regenera el catálogo: `npm run config:catalog`.
