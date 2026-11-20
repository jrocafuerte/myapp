/**
 * PUNTO DE ENTRADA ÚNICO DEL DESIGN SYSTEM
 * ---------------------------------------------------------------------------
 * Toda la app importa componentes, tokens y tema SOLO desde aquí.
 *
 * Para reemplazarlo por tu propia librería cambiá UNA línea:
 *     import * as adapter from './adapters/default';
 * por
 *     import * as adapter from './adapters/mi-libreria';
 * El objeto `components` está tipado con el contrato: si tu adaptador no lo
 * cumple, `npm run typecheck` indica exactamente qué componente o prop falta.
 */
import * as adapter from './adapters/default';
import type { DesignSystemComponents } from './contracts';

const components: DesignSystemComponents = adapter;

export const {
  Text, Icon, Button, ConfirmButton, IconButton, Input, Chips, ListItem, ToggleRow, Stack, Inline, Card, Surface, Screen,
  Banner, EmptyState, Progress, Stat, KeyValue, BarList, ColumnChart, Badge, Avatar, Swatch, Spinner,
} = components;

export * from './contracts';
export * from './theme';
export * from './tokens';
