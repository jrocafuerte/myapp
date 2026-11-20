import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DesignSystemProvider, Spinner, Stack as DSStack, useTheme } from '../design-system';
import { BankProvider, useBank } from '../store/BankContext';

function Gate() {
  const { ready, authenticated } = useBank();
  const { colors, dark } = useTheme();
  const segments = useSegments();
  if (!ready) return <DSStack flex align="center" justify="center" background="bg"><Spinner /></DSStack>;
  const onLogin = segments[0] === 'login';
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {!authenticated && !onLogin ? <Redirect href="/login" /> : null}
      {authenticated && onLogin ? <Redirect href="/" /> : null}
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg }, headerBackTitle: 'Atrás' }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feature/[id]" options={{ title: '' }} />
        <Stack.Screen name="cuenta/[id]" options={{ title: 'Cuenta' }} />
        <Stack.Screen name="movimiento/[id]" options={{ title: 'Movimiento' }} />
        <Stack.Screen name="tarjeta/[id]" options={{ title: 'Tarjeta' }} />
        <Stack.Screen name="design-system" options={{ title: 'Design system' }} />
      </Stack>
    </>
  );
}

/** Conecta la preferencia de tema del usuario con el design system. */
function ThemedApp() {
  const { dark } = useBank();
  return <DesignSystemProvider dark={dark}><Gate /></DesignSystemProvider>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BankProvider>
        <ThemedApp />
      </BankProvider>
    </SafeAreaProvider>
  );
}
