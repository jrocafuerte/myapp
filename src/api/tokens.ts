/**
 * Tokens de sesión. En iOS/Android se guardan cifrados en el llavero/Keystore (expo-secure-store).
 * En web solo en memoria: no se exponen a scripts en localStorage y la sesión termina al recargar.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface Tokens { accessToken: string; refreshToken?: string; expiresAt: number }
const KEY = 'banco-plus-session-v1';
let memory: Tokens | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  if (memory || Platform.OS === 'web') return memory;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    memory = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch { memory = null; }
  return memory;
}

export async function saveTokens(t: Tokens | null) {
  memory = t;
  if (Platform.OS === 'web') return;
  try {
    if (t) await SecureStore.setItemAsync(KEY, JSON.stringify(t), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
  } catch { /* sin almacenamiento seguro: la sesión vive solo en memoria */ }
}
