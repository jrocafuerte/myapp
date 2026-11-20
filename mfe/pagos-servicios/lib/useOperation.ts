'use client';
import { useState } from 'react';
import type { Operation } from '../../../shared/pagos-mfe/protocol';
import { useBridge } from './BridgeProvider';

/** Pide una operación a la app y expone el resultado para mostrarlo con Banner. */
export function useOperation() {
  const { request } = useBridge();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (op: Operation, okMsg: string) => {
    setBusy(true); setError(null); setSuccess(null);
    const r = await request(op);
    setBusy(false);
    if (r.ok) setSuccess(okMsg); else setError(r.error);
    return r.ok;
  };
  return { run, error, success, busy };
}
