import { useRemoteConfig } from '../remote-config/RemoteConfigProvider';
import { useBank } from '../store/BankContext';

const dict = {
  es: { home: 'Inicio', movements: 'Movimientos', payments: 'Pagos', cards: 'Tarjetas', more: 'Más', hello: 'Hola',
    total: 'Saldo total', accounts: 'Mis cuentas', quick: 'Accesos rápidos', recent: 'Últimos movimientos', seeAll: 'Ver todo',
    search: 'Buscar', all: 'Todas las funcionalidades', logout: 'Cerrar sesión' },
  en: { home: 'Home', movements: 'Activity', payments: 'Payments', cards: 'Cards', more: 'More', hello: 'Hi',
    total: 'Total balance', accounts: 'My accounts', quick: 'Quick actions', recent: 'Recent activity', seeAll: 'See all',
    search: 'Search', all: 'All features', logout: 'Log out' },
};
export type TKey = keyof typeof dict.es;
/** Claves que la configuración remota puede reemplazar en la sección "texts". */
export const TEXT_KEYS = Object.keys(dict.es) as TKey[];

/**
 * Texto de interfaz en el idioma elegido. Si la configuración remota define la clave,
 * se usa ese texto (en cualquier idioma) o, si existe, `<clave>.<idioma>` (p. ej. "home.en").
 */
export function useT() {
  const { state } = useBank();
  const { config } = useRemoteConfig();
  const lang = state.settings.language;
  return (k: TKey) => config.texts?.[`${k}.${lang}`] ?? config.texts?.[k] ?? dict[lang][k];
}
