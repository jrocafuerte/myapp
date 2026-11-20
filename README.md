# Banco Plus — App bancaria en React Native (Expo)

App bancaria móvil con **117 funcionalidades** organizadas en 13 módulos. Corre en iOS, Android y web.

## Cómo ejecutarla

```bash
npm install
npx expo start
```

El módulo de Pago de servicios es un micro frontend aparte. Para usarlo en desarrollo:

```bash
npm run mfe:dev   # en otra terminal; sirve mfe/pagos-servicios en http://localhost:3001
```

Escaneá el QR con **Expo Go** (o presioná `w` para web, `a` para Android, `i` para iOS).

**Usuario demo:** `demo` · **Contraseña:** `demo1234` · Token digital: Más → Token digital.

```bash
npm test          # lógica de negocio, conteo de funcionalidades, contraste WCAG y límites del design system
npm run typecheck # TypeScript estricto
```

## Arquitectura

| Carpeta | Contenido |
|---|---|
| `src/app/` | Rutas de Expo Router: login, 5 pestañas (Inicio, Movimientos, Pagos, Tarjetas, Más) y pantallas `feature/[id]`, `cuenta/[id]`, `movimiento/[id]`, `tarjeta/[id]` |
| `src/store/logic.ts` | **Toda la lógica de negocio** como funciones puras `(estado, …) => estado` con validaciones (`BankError`). Lista para mover a un backend |
| `src/store/BankContext.tsx` | Estado global, persistencia en AsyncStorage, sesión, cierre por inactividad, tema |
| `src/store/seed.ts` | Datos de demostración (3 meses de movimientos, cuentas, tarjetas, préstamo, inversiones…) |
| `src/features/modules/*.tsx` | Pantallas de las funcionalidades, agrupadas por módulo |
| `src/features/registry.ts` | Catálogo único de funcionalidades (se navega y busca desde **Más**) |
| `src/design-system/` | **Design system reemplazable**: tokens, tema claro/oscuro, contrato de 25 componentes y adaptador por defecto. Ver [su README](src/design-system/README.md) |
| `src/ui/` | Capa de UI de la app: reexporta el design system y agrega piezas bancarias (selector de cuentas, feedback de operaciones) |
| `mfe/pagos-servicios/` | **Micro frontend** de Pago de servicios (Next.js), embebido en la app con WebView. Ver [su README](mfe/pagos-servicios/README.md) |
| `shared/pagos-mfe/` | Contrato tipado entre la app y el micro frontend |
| `src/app/design-system.tsx` | Catálogo vivo de tokens y componentes (Más → Design system) |

Procesos automáticos al abrir la app: ejecución de transferencias programadas, débitos automáticos, recordatorios de vencimientos y vencimiento de plazos fijos.

## Importante antes de producción

Es una app **front-end completa con datos simulados y persistencia local**. Para operar con dinero real hace falta:

- Un backend/core bancario: `logic.ts` describe las reglas, pero saldos, límites y validaciones deben aplicarse en el servidor.
- Autenticación real (OAuth2/OIDC), contraseñas con hash en servidor y tokens en `expo-secure-store` (hoy la contraseña demo vive en AsyncStorage).
- OTP real (TOTP/RFC 6238 o push), una librería QR estándar (el QR actual es visual) y cotizaciones de un proveedor de mercado.
- Cumplimiento: KYC/AML, PCI-DSS para datos de tarjetas, auditoría y cifrado.
- La biometría requiere un development build (`npx expo run:ios|android`) para Face ID en iOS.

## Las 117 funcionalidades

### Seguridad y acceso (12)

1. **Inicio de sesión seguro** — Usuario y contraseña con registro de intentos
2. **Ingreso biométrico** — Huella o Face ID
3. **PIN de acceso rápido** — Ingresá con un PIN numérico
4. **Cambiar contraseña** — Con medidor de fortaleza
5. **Autenticación en dos pasos** — Activá o desactivá el 2FA
6. **Token digital (OTP)** — Código que cambia cada 30 s
7. **Cierre automático de sesión** — Tiempo de inactividad
8. **Dispositivos vinculados** — Revisá y desvinculá
9. **Historial de accesos** — Accesos exitosos y fallidos
10. **Preguntas de seguridad** — Para recuperar tu acceso
11. **Modo privacidad** — Ocultá tus saldos
12. **Bloqueo de emergencia** — Congelá tarjetas y operaciones

### Cuentas (10)

13. **Resumen de patrimonio** — Saldo total, inversiones y deudas
14. **Mis cuentas** — Todas tus cuentas activas
15. **Detalle de cuenta** — Número, código interbancario y saldo
16. **Compartir datos de cuenta** — Copiá o enviá tus datos
17. **Abrir nueva cuenta** — Ahorro o corriente, en 3 monedas
18. **Alias de cuenta** — Personalizá el nombre
19. **Cuenta principal** — Predeterminada para operar
20. **Cerrar cuenta** — Baja de cuentas sin saldo
21. **Cuentas multimoneda** — USD, EUR y GBP con cotizaciones
22. **Certificado de cuenta** — Constancia de titularidad

### Movimientos (10)

23. **Historial de movimientos** — Todos tus movimientos
24. **Búsqueda de movimientos** — Por comercio, nota o referencia
25. **Filtros avanzados** — Por tipo, cuenta y categoría
26. **Detalle de movimiento** — Toda la información de una operación
27. **Comprobantes** — Compartí el comprobante
28. **Categorización automática** — Clasificación inteligente
29. **Recategorizar movimientos** — Corregí la categoría
30. **Notas en movimientos** — Agregá contexto a tus gastos
31. **Estado de cuenta mensual** — Saldo inicial, final y detalle
32. **Exportar a CSV** — Descargá tus movimientos

### Transferencias (14)

33. **Entre mis cuentas** — Inmediata, con conversión de moneda
34. **A terceros** — A tu agenda de destinatarios
35. **Por alias o número** — A cualquier cuenta
36. **Agenda de destinatarios** — Tus contactos frecuentes
37. **Agregar destinatario** — Con validación de cuenta
38. **Eliminar destinatario** — Mantené tu agenda limpia
39. **Favoritos** — Transferí en dos toques
40. **Transferencias programadas** — Elegí la fecha de envío
41. **Transferencias recurrentes** — Semanales o mensuales
42. **Límites de transferencia** — Por operación y diario
43. **Transferencia internacional** — SWIFT con IBAN
44. **Cobrar con QR** — Generá tu código de cobro
45. **Pedir dinero** — Enviá y respondé solicitudes
46. **Dividir gastos** — Repartí una cuenta entre amigos

### Pagos (10)

47. **Pago de servicios** — Luz, agua, gas, internet
48. **Servicios adheridos** — Agregá o quitá servicios
49. **Recarga de celular** — Todas las operadoras
50. **Pago de impuestos** — Predial, vehicular, renta
51. **Débito automático** — Pagá sin acordarte
52. **Recordatorios de vencimiento** — Alertas antes de vencer
53. **Historial de pagos** — Todos tus pagos realizados
54. **Pagar con QR** — En comercios adheridos
55. **Recarga de transporte** — Tarjeta de transporte público
56. **Pagar tarjeta de crédito** — Mínimo, total u otro monto

### Tarjetas (13)

57. **Mis tarjetas** — Débito, crédito y virtuales
58. **Bloqueo temporal** — Pausá y reactivá al instante
59. **Denuncia por robo o pérdida** — Cancelación y reposición
60. **Ver datos de la tarjeta** — Número y CVV con token
61. **Tarjeta virtual** — Creala al instante
62. **Tarjeta de un solo uso** — Máxima seguridad online
63. **Cambiar PIN** — De tus tarjetas físicas
64. **Límite de gasto** — Controlá cuánto gastás
65. **Compras online y exterior** — Activá o desactivá
66. **Aviso de viaje** — Usá tu tarjeta afuera sin rechazos
67. **Resumen de tarjeta de crédito** — Saldo, mínimo y vencimiento
68. **Compras en cuotas** — Simulá y financiá
69. **Aumento de límite** — Evaluación instantánea

### Ahorro y presupuesto (11)

70. **Metas de ahorro** — Creá y seguí tus objetivos
71. **Aportar a una meta** — Sumá dinero a tus metas
72. **Retirar de una meta** — Recuperá tu dinero
73. **Redondeo automático** — Ahorrá con cada compra
74. **Presupuesto mensual** — Límites por categoría
75. **Alertas de presupuesto** — Avisos al 80% y 100%
76. **Análisis de gastos** — Gráfico por categoría
77. **Ingresos vs egresos** — Evolución de 6 meses
78. **Plazo fijo** — Hacé crecer tus ahorros
79. **Simulador de plazo fijo** — Calculá intereses y TEA
80. **Gastos recurrentes** — Detectá suscripciones

### Préstamos (7)

81. **Simulador de préstamo** — Sistema francés
82. **Solicitar préstamo** — Aprobación inmediata
83. **Mis préstamos** — Estado y saldo
84. **Pagar cuota** — Pagá tu cuota del mes
85. **Tabla de amortización** — Cuota por cuota
86. **Precancelación** — Cancelá antes y ahorrá intereses
87. **Simulador hipotecario** — Hasta 30 años

### Inversiones (8)

88. **Mi portafolio** — Posiciones y rendimiento
89. **Comprar acciones y ETF** — Operá en el mercado
90. **Vender inversiones** — Rescatá tus posiciones
91. **Fondos de inversión** — Renta fija, mixtos y acciones
92. **Cotizaciones** — Precios en tiempo real
93. **Compra/venta de divisas** — USD, EUR, GBP
94. **Criptomonedas** — BTC, ETH y stablecoins
95. **Perfil de inversor** — Test de 5 preguntas

### Seguros (4)

96. **Mis seguros** — Pólizas y siniestros
97. **Contratar seguro** — Vida, hogar, auto y más
98. **Cotizar seguro** — Prima al instante
99. **Denunciar siniestro** — Iniciá tu reclamo

### Notificaciones (6)

100. **Centro de notificaciones** — Filtrá, leé y borrá
101. **Preferencias de aviso** — Push, email y SMS por tipo
102. **Alerta de saldo bajo** — Avisá cuando baje de un monto
103. **Alerta de movimientos grandes** — Detectá operaciones inusuales
104. **Buzón de mensajes** — Comunicaciones del banco
105. **Ofertas personalizadas** — Beneficios para vos

### Perfil y configuración (7)

106. **Mi perfil** — Datos personales y avatar
107. **Idioma** — Español / English
108. **Tema oscuro** — Claro, oscuro o del sistema
109. **Moneda de visualización** — Para tu saldo total
110. **Documentos y contratos** — Tus contratos y pólizas
111. **Puntos y recompensas** — Sumá y canjeá
112. **Invitá amigos** — Ganá 500 puntos por invitado

### Ayuda y soporte (5)

113. **Centro de ayuda** — Preguntas frecuentes
114. **Asistente virtual** — Respuestas con tus datos
115. **Tickets de soporte** — Creá y seguí reclamos
116. **Sucursales y cajeros** — Encontrá el más cercano
117. **Contactos de emergencia** — Líneas 24 h y tus contactos
