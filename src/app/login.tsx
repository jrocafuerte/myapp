import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as L from '../store/logic';
import { useBank } from '../store/BankContext';
import {
  Banner, Button, Card, Chips, Input, Text, Stack, useTheme,
} from '../ui/kit';

export default function Login() {
  const { state, replace, run, setAuthenticated } = useBank();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'password' | 'pin'>(state.settings.pin ? 'pin' : 'password');
  const [user, setUser] = useState(''); const [pwd, setPwd] = useState(''); const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const locked = attempts >= 5;

  const enter = () => { setAuthenticated(true); router.replace('/'); };
  const withPassword = () => {
    const { ok, state: next } = L.login(state, user, pwd);
    replace(next);
    if (ok) enter(); else { setAttempts(attempts + 1); setError(`Usuario o contraseña incorrectos. Intentos restantes: ${4 - attempts}`); }
  };
  const withPin = () => {
    if (pin === state.settings.pin) { run((s) => L.recordLogin(s, 'PIN')); enter(); }
    else { setAttempts(attempts + 1); setError('PIN incorrecto.'); setPin(''); }
  };
  const withBiometric = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Ingresá a Banco Plus' });
    if (r.success) { run((s) => L.recordLogin(s, 'biometría')); enter(); } else setError('No pudimos verificar tu identidad.');
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
          {state.settings.pin ? <Chips options={[{ label: 'Contraseña', value: 'password' as const }, { label: 'PIN', value: 'pin' as const }]} value={mode} onChange={setMode} /> : null}
          {mode === 'password' ? (
            <>
              <Input label="Usuario" value={user} onChangeText={setUser} autoCapitalize="none" autoComplete="username" />
              <Input label="Contraseña" value={pwd} onChangeText={setPwd} secureTextEntry autoComplete="password" onSubmitEditing={withPassword} />
              <Button title="Ingresar" onPress={withPassword} disabled={locked || !user || !pwd} />
            </>
          ) : (
            <>
              <Input label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} onSubmitEditing={withPin} />
              <Button title="Ingresar con PIN" onPress={withPin} disabled={locked || pin.length < 4} />
            </>
          )}
          {state.settings.biometricEnabled && Platform.OS !== 'web' ? <Button title="Usar huella / Face ID" icon="finger-print" variant="secondary" onPress={withBiometric} /> : null}
          <Banner kind="error" text={locked ? 'Demasiados intentos. Reiniciá la app o contactá a soporte.' : error} />
          <Text variant="caption" tone="muted" align="center">Demo: usuario <Text variant="caption" weight="bold">demo</Text> · contraseña <Text variant="caption" weight="bold">demo1234</Text></Text>
        </Card>
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
