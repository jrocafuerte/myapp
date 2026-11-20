import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BankProvider, useBank } from '../store/BankContext';

function Gate() {
  const { ready, authenticated, colors, dark } = useBank();
  const segments = useSegments();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BankProvider>
        <Gate />
      </BankProvider>
    </SafeAreaProvider>
  );
}
