/** λ scheduler — EventBridge diario: ejecuta transferencias programadas, débitos automáticos y plazos fijos. */
import { matureDeposits, processBills, runScheduled } from '../../../shared/domain/logic';
import { getDeps } from '../deps';
import { log } from '../logger';

export async function handler() {
  const { store, core } = getDeps();
  let processed = 0; let failed = 0;
  for await (const userId of store.listUserIds()) {
    try { await core.runDaily(userId, (s) => matureDeposits(processBills(runScheduled(s)))); processed++; } catch (e) {
      failed++; log('error', 'daily_failed', { error: e instanceof Error ? e.message : String(e) });
    }
  }
  log('info', 'daily_done', { processed, failed });
  return { processed, failed };
}
