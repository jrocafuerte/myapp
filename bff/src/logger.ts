/** Logs estructurados en JSON (CloudWatch Logs Insights). Nunca registrar montos, nombres, tokens ni contraseñas. */
type Level = 'info' | 'warn' | 'error';
export const log = (level: Level, msg: string, fields: Record<string, unknown> = {}) =>
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields }));
