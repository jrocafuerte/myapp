import type { Currency } from '../../../shared/pagos-mfe/protocol';

const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Mismo formato que la app nativa: símbolo, miles con coma y dos decimales. */
export function money(amount: number, currency: Currency = 'USD', opts: { hidden?: boolean; sign?: boolean } = {}) {
  if (opts.hidden) return `${SYMBOL[currency]} ••••`;
  const abs = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '−' : opts.sign && amount > 0 ? '+' : '';
  return `${sign}${SYMBOL[currency]}${abs}`;
}

export function date(iso: string, withTime = false) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${base} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}

/** Días hasta una fecha AAAA-MM-DD (negativo si ya venció). */
export function daysUntil(day: string, now = new Date()) {
  const target = new Date(`${day}T12:00:00`).getTime();
  const today = new Date(now.toISOString().slice(0, 10) + 'T12:00:00').getTime();
  return Math.round((target - today) / 864e5);
}
