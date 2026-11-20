import type { Currency } from '../store/types';

const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };

export function money(amount: number, currency: Currency = 'USD', opts: { sign?: boolean; hidden?: boolean } = {}) {
  if (opts.hidden) return `${SYMBOL[currency]} ••••`;
  const abs = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '−' : opts.sign && amount > 0 ? '+' : '';
  return `${sign}${SYMBOL[currency]}${abs}`;
}

export const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function date(iso: string, withTime = false) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${base} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const maskCard = (n: string) => `•••• ${n.slice(-4)}`;
export const groupCard = (n: string) => n.replace(/(\d{4})(?=\d)/g, '$1 ');
export const parseAmount = (s: string) => { const n = Number(s.replace(/,/g, '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : NaN; };
export const isoDay = (offsetDays = 0) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10); };
