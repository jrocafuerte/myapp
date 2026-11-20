import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useBank } from '../../store/BankContext';
import { useT } from '../../utils/i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  const { colors, state } = useBank();
  const t = useT();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: t('home'), headerShown: false, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="movimientos" options={{ title: t('movements'), tabBarIcon: icon('list') }} />
      <Tabs.Screen name="pagos" options={{ title: t('payments'), tabBarIcon: icon('swap-horizontal') }} />
      <Tabs.Screen name="tarjetas" options={{ title: t('cards'), tabBarIcon: icon('card') }} />
      <Tabs.Screen name="mas" options={{ title: t('more'), tabBarIcon: icon('grid'), tabBarBadge: unread || undefined }} />
    </Tabs>
  );
}
