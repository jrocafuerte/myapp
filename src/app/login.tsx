import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBank } from '../store/BankContext';
import {
  Banner, Button, Card, Chips, Input, Text, Stack, useTheme,
} from '../ui/kit';

export default function Login() {
  const { state, signIn, quickUnlock, mode: dataMode } = useBank();
  const quick = dataMode === 'local'; // PIN y biometría: solo en modo local
  const { colors } = useTheme();
  const [mode, setMode] = useState<'password' | 'pin'>(quick && state.settings.pin ? 'pin' : 'password');
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(''); const [pwd, setPwd] = useState(''); const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const locked = attempts >= 5;

  const enter = () => router.replace('/');
  const withPassword = async () => {
    setBusy(true);
    const err = await signIn(user, pwd);
    setBusy(false);
    if (!err) return enter();
    setAttempts(attempts + 1);
    setError(attempts >= 3 ? `${err} Intentos restantes: ${4 - attempts}` : err);
  };
  const withPin = () => {
    if (pin === state.settings.pin) { quickUnlock('PIN'); enter(); }
    else { setAttempts(attempts + 1); setError('PIN incorrecto.'); setPin(''); }
  };
  const withBiometric = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Ingresá a Banco Plus' });
    if (r.success) { quickUnlock('biometría'); enter(); } else setError('No pudimos verificar tu identidad.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.hero }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
        <Stack padding="xl" gap="xl">
        <Stack align="center" gap="xs">
          <Text variant="display" tone="inverse">Banco Plus</Text>
          <Text tone="onHero">Tu banco, en tu bolsillo</Text>
        </Stack>
        <Card>
          {quick && state.settings.pin ? <Chips options={[{ label: 'Contraseña', value: 'password' as const }, { label: 'PIN', value: 'pin' as const }]} value={mode} onChange={setMode} /> : null}
          {mode === 'password' ? (
            <>
              <Input label="Usuario" value={user} onChangeText={setUser} autoCapitalize="none" autoComplete="username" />
              <Input label="Contraseña" value={pwd} onChangeText={setPwd} secureTextEntry autoComplete="password" onSubmitEditing={withPassword} />
              <Button title="Ingresar" onPress={withPassword} loading={busy} disabled={locked || !user || !pwd} />
            </>
          ) : (
            <>
              <Input label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} onSubmitEditing={withPin} />
              <Button title="Ingresar con PIN" onPress={withPin} disabled={locked || pin.length < 4} />
            </>
          )}
          {quick && state.settings.biometricEnabled && Platform.OS !== 'web' ? <Button title="Usar huella / Face ID" icon="finger-print" variant="secondary" onPress={withBiometric} /> : null}
          <Banner kind="error" text={locked ? 'Demasiados intentos. Reiniciá la app o contactá a soporte.' : error} />
          <Text variant="caption" tone="muted" align="center">Demo: usuario <Text variant="caption" weight="bold">demo</Text> · contraseña <Text variant="caption" weight="bold">demo1234</Text></Text>
        </Card>
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
