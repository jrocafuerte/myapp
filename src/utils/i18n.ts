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
export function useT() {
  const { state } = useBank();
  return (k: TKey) => dict[state.settings.language][k];
}
