'use client';
/** Componentes del micro frontend, equivalentes a los del design system nativo. */
import React, { useState } from 'react';
import { useBridge } from '../lib/BridgeProvider';

const PATHS: Record<string, React.ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3-1-3 0-6 0-8z" />,
  wifi: <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" /></>,
  phone: <rect x="7" y="2.5" width="10" height="19" rx="2" />,
  tv: <><rect x="2.5" y="5" width="19" height="13" rx="2" /><path d="M8 21h8" /></>,
  bank: <path d="M3 9 12 4l9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />,
  doc: <><path d="M6 2.5h8l4 4V21H6z" /><path d="M14 2.5V7h4M9 12h6M9 16h6" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  share: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6.5h14V13" /></>,
  tray: <><path d="M3 13h5l1 3h6l1-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  sync: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M4 3v5h5M20 21v-5h-5" /></>,
};
export const Icon = ({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) => (
  <svg className="i" viewBox="0 0 24 24" width={size} height={size} style={{ width: size, height: size }} aria-hidden="true">{PATHS[name]}</svg>
);
export const SERVICE_ICON: Record<string, keyof typeof PATHS> = { Luz: 'bolt', Agua: 'drop', Gas: 'flame', Internet: 'wifi', Telefonía: 'phone', TV: 'tv', Impuestos: 'bank', Otro: 'doc' };

/** Contenedor de cada pantalla, con título accesible y la transición de entrada. */
export function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="screen">
      <h1 className="sr-only" tabIndex={-1}>{title}</h1>
      {children}
    </main>
  );
}

export const Card = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <section className="card" aria-label={label}>{children}</section>
);

export function ListItem({ icon, title, subtitle, right, rightClass, onPress }: {
  icon?: keyof typeof PATHS; title: string; subtitle?: string; right?: string; rightClass?: string; onPress?: () => void;
}) {
  const body = (
    <>
      {icon ? <span className="item__icon"><Icon name={icon} /></span> : null}
      <span className="item__text">
        <span className="item__title">{title}</span>
        {subtitle ? <span className="t-caption muted">{subtitle}</span> : null}
      </span>
      {right ? <span className={`bold num ${rightClass ?? ''}`}>{right}</span> : null}
      {onPress ? <span className="chev"><Icon name="chev" size={16} /></span> : null}
    </>
  );
  return onPress ? <button type="button" className="item" onClick={onPress}>{body}</button> : <div className="item">{body}</div>;
}

export function Button({ title, onPress, variant, small, disabled, loading, icon }: {
  title: string; onPress: () => void; variant?: 'secondary' | 'danger' | 'ghost'; small?: boolean; disabled?: boolean; loading?: boolean; icon?: keyof typeof PATHS;
}) {
  return (
    <button type="button" className={`btn ${variant ? `btn--${variant}` : ''} ${small ? 'btn--small' : ''}`} disabled={disabled || loading}
      aria-busy={loading || undefined} onClick={onPress}>
      {icon ? <Icon name={icon} size={small ? 16 : 20} /> : null}
      {loading ? 'Procesando…' : title}
    </button>
  );
}

/** Pide un segundo toque antes de una acción irreversible (igual que en la app). */
export function ConfirmButton({ title, onConfirm, small }: { title: string; onConfirm: () => void; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button small={small} variant={armed ? 'danger' : 'ghost'} title={armed ? 'Tocá de nuevo para confirmar' : title}
      onPress={() => { if (armed) { setArmed(false); onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }} />
  );
}

export function Field({ id, label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint ? <span id={`${id}-hint`} className="t-caption muted">{hint}</span> : null}
    </div>
  );
}

export function Chips<V extends string>({ label, options, value, onChange }: { label: string; options: { label: string; value: V }[]; value: V | undefined; onChange: (v: V) => void }) {
  const { haptic } = useBridge();
  return (
    <div className="field">
      <span className="label" id={`chips-${label}`}>{label}</span>
      <div className="chips" role="radiogroup" aria-labelledby={`chips-${label}`}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="chip"
            onClick={() => { haptic('selection'); onChange(o.value); }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={value} className="toggle" disabled={disabled} onClick={() => onChange(!value)}>
      <span className="item__text"><span className="item__title">{title}</span>{subtitle ? <span className="t-caption muted">{subtitle}</span> : null}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

export function Banner({ kind, text }: { kind: 'error' | 'success' | 'info'; text: string | null }) {
  if (!text) return null;
  const cls = kind === 'error' ? 'danger' : kind === 'success' ? 'success' : 'primary';
  return (
    <div className={`banner ${cls}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info'} />
      <span>{text}</span>
    </div>
  );
}

export const Empty = ({ text, icon = 'tray' }: { text: string; icon?: keyof typeof PATHS }) => (
  <div className="empty"><Icon name={icon} size={36} /><span>{text}</span></div>
);

export const KeyValue = ({ k, v }: { k: string; v: string }) => (
  <div className="between"><span className="muted">{k}</span><span className="semibold num selectable" style={{ textAlign: 'right' }}>{v}</span></div>
);

/** Esqueleto mientras llega el contexto de la app. */
export const Skeleton = () => (
  <main className="screen" aria-busy="true" aria-label="Cargando">
    {[88, 64, 64, 64].map((h, i) => <div key={i} className="skeleton" style={{ height: h }} />)}
  </main>
);
