# Design system de Banco Plus

La app usa sus componentes, tokens y tema **solo** a través de `src/design-system/index.ts`. Por eso cambiar de librería es cambiar una línea.

```
src/design-system/
├── index.ts              ← punto de entrada único (aquí se elige el adaptador)
├── contracts.ts          ← la API que la app usa: 25 componentes y sus props
├── tokens.ts             ← valores base: paleta, espaciado, radios, tipografía, tamaños, elevación
├── theme.ts              ← roles de color (claro/oscuro), DesignSystemProvider y useTheme()
├── adapters/default/     ← implementación incluida (React Native + Ionicons)
└── __tests__/
    ├── contrast.test.ts  ← verifica contraste WCAG AA de todos los roles, en claro y oscuro
    └── boundary.test.ts  ← falla si la app usa primitivas, íconos o colores fuera del design system
```

La capa `src/ui/kit.tsx` **no** es parte del design system: reexporta todo y agrega piezas del dominio bancario (`AccountPicker`, `useAction`, `Screen` con control de inactividad). No hay que tocarla al cambiar de librería.

## Reglas

| Para… | Usá | Nunca |
|---|---|---|
| Texto | `<Text variant="heading" tone="muted">` | `fontSize: 17`, `color: '#5B6B82'` |
| Espacios | `gap="md"`, `padding="lg"` | `gap: 12`, `padding: 16` |
| Filas y columnas | `<Inline>` / `<Stack>` | `<View style={{ flexDirection: 'row' }}>` |
| Contenedores | `<Card>` / `<Surface background="primarySoft" radius="lg">` | `backgroundColor`, `borderRadius` sueltos |
| Íconos | `<Icon name="card-outline" size="lg" tone="primary">` | `import { Ionicons }` |
| Colores en código | `useTheme().colors.primary` (solo para APIs de terceros, p. ej. la barra de pestañas) | hex en pantallas |

`npm test` hace cumplir estas reglas con `boundary.test.ts`.

## Cómo reemplazarlo por tu propia librería

### 1. Cambiar solo la marca

Si tu librería es solo un set de tokens (colores, tipografía, espaciado):

1. Reemplazá los valores de `tokens.ts` (paleta, `typography`, `spacing`, `radius`…).
2. Asigná tus colores a los roles de `theme.ts` (`lightColors` / `darkColors`). Los **nombres** de los roles son el contrato; los **valores** son tu marca.
3. Ejecutá `npm test`: `contrast.test.ts` te avisa si alguna combinación no llega a WCAG AA.

### 2. Usar tus propios componentes

1. Creá `src/design-system/adapters/mi-libreria/index.tsx`.
2. Exportá los 25 componentes de `DesignSystemComponents` (ver `contracts.ts`), envolviendo los de tu librería. Por ejemplo:

   ```tsx
   import { Button as MiBoton } from '@mi-empresa/design-system';
   import type * as C from '../../contracts';

   export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, small }: C.ButtonProps) {
     return (
       <MiBoton
         label={title}
         onClick={onPress}
         kind={{ primary: 'filled', secondary: 'tonal', danger: 'destructive', ghost: 'text' }[variant]}
         size={small ? 'sm' : 'md'}
         leadingIcon={icon}
         isDisabled={disabled}
         isLoading={loading}
       />
     );
   }
   ```

   Podés empezar copiando `adapters/default` y reemplazar los componentes de a uno.
3. En `index.ts`, cambiá
   `import * as adapter from './adapters/default';`
   por
   `import * as adapter from './adapters/mi-libreria';`
4. Ejecutá `npm run typecheck`. Si falta un componente o una prop no coincide, TypeScript lo indica en `index.ts`.
5. Abrí **Más → Design system (catálogo)** en la app y revisá cada componente en modo claro y oscuro.

### Tokens con tu propio provider

Si tu librería trae su propio `ThemeProvider`, envolvelo dentro de `DesignSystemProvider` (en `theme.ts`) o hacé que `useTheme()` devuelva tus tokens con la misma forma que `Theme`.

### Íconos

El contrato pide íconos por nombre (`IconName`). La app usa nombres de [Ionicons](https://icons.expo.fyi). Si tu librería tiene su propio set, mapealos dentro del `Icon` de tu adaptador:

```tsx
const MAPA: Record<string, string> = { 'card-outline': 'credit-card', 'wallet-outline': 'wallet' /* … */ };
export const Icon = ({ name, ...p }: C.IconProps) => <MiIcono glyph={MAPA[name] ?? 'circle'} {...p} />;
```

Para ver qué nombres usa la app: `grep -rhoE "icon[=:] ?['\"][a-z-]+" src | sort -u`.

## Accesibilidad incluida en el contrato

- Botones, interruptores y elementos de lista con altura mínima de 44 pt (`sizing.touchTarget`).
- Roles y estados accesibles (`button`, `progressbar`, `alert`, `selected`, `disabled`).
- Contraste AA verificado en tests para todos los pares de texto/fondo usados.
