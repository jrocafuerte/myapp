'use client';
import React from 'react';
import { useBridge } from '../lib/BridgeProvider';
import { Banner, Empty, Skeleton } from './ui';

/** Muestra el contenido solo cuando la app envió su contexto. */
export function Gate({ children }: { children: React.ReactNode }) {
  const { status, mode } = useBridge();
  if (status === 'connecting') return <Skeleton />;
  if (status === 'unavailable') {
    return (
      <main className="screen">
        <h1 className="t-heading" tabIndex={-1}>Pago de servicios</h1>
        <Empty icon="info" text={mode === 'standalone' ? 'Este módulo se abre desde la app Banco Plus.' : 'No pudimos conectar con la app. Cerrá y volvé a abrir esta sección.'} />
      </main>
    );
  }
  return (
    <>
      {mode === 'standalone' ? <div style={{ padding: '8px 16px 0' }}><Banner kind="info" text="Modo independiente con datos de ejemplo (solo desarrollo)." /></div> : null}
      {children}
    </>
  );
}
