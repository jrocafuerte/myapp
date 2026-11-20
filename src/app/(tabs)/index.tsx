import { router } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TxRow } from '../../features/modules/accounts';
import { UserAvatar } from '../../features/modules/profile';
import * as L from '../../store/logic';
import { cmd } from '../../store/commands';
import { useBank } from '../../store/BankContext';
import { FeatureGrid } from '../../ui/FeatureTile';
import {
  Banner, Button, Card, IconButton, Inline, ListItem, Stack, Surface, Text, useTheme,
} from '../../ui/kit';
import { date, money } from '../../utils/format';
import { useT } from '../../utils/i18n';

export default function Home() {
  const { state, run, touch } = useBank();
  const { colors } = useTheme();
  const t = useT();
  const cur = state.settings.displayCurrency; const hidden = state.settings.hideBalances;
  const unread = state.notifications.filter((n) => !n.read).length;
  const alerts = L.budgetStatus(state).filter((b) => b.over);
  const bills = state.services.filter((s) => s.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 2);
  const sectionHeader = (title: string, onPress: () => void) => (
    <Inline justify="between"><Text variant="heading">{title}</Text><Button small variant="ghost" title={t('seeAll')} onPress={onPress} /></Inline>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.hero }}>
      <ScrollView style={{ backgroundColor: colors.bg }} onTouchStart={touch}>
        <Stack background="hero" padding="xl" gap="lg">
          <Inline gap="md">
            <Surface onPress={() => router.push('/feature/profile')} accessibilityLabel="Mi perfil" radius="pill"><UserAvatar size="md" /></Surface>
            <Stack flex>
              <Text tone="onHero" variant="bodySmall">{t('hello')},</Text>
              <Text tone="inverse" variant="heading">{state.user.name.split(' ')[0]}</Text>
            </Stack>
            <IconButton icon={hidden ? 'eye-off-outline' : 'eye-outline'} tone="inverse" accessibilityLabel={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
              onPress={() => run(cmd.updatePreferences({ hideBalances: !hidden }))} />
            <IconButton icon="notifications-outline" tone="inverse" badge={unread} accessibilityLabel={`Notificaciones, ${unread} sin leer`} onPress={() => router.push('/feature/notification-center')} />
          </Inline>
          {state.settings.quickBalanceWidget ? (
            <Surface onPress={() => router.push('/feature/balance-summary')} accessibilityLabel={t('total')}>
              <Text tone="onHero">{t('total')} ({cur})</Text>
              <Text tone="inverse" variant="display">{money(L.totalBalance(state, cur), cur, { hidden })}</Text>
            </Surface>
          ) : null}
        </Stack>
        <Stack padding="lg" gap="md">
          {state.user.emergencyLocked ? <Banner kind="error" text="Bloqueo de emergencia activo. Tocá Más → Bloqueo de emergencia para desbloquear." /> : null}
          <Card>
            <FeatureGrid ids={['transfer-third', 'pay-services', 'receive-qr', 'pay-qr', 'mobile-topup', 'savings-goals', 'loan-simulator', 'chatbot']} />
          </Card>
          <Card>
            {sectionHeader(t('accounts'), () => router.push('/feature/accounts-list'))}
            {state.accounts.filter((a) => !a.closed).map((a) => (
              <ListItem key={a.id} icon="wallet-outline" title={`${a.alias}${a.isPrimary ? ' ★' : ''}`} subtitle={a.number} right={money(a.balance, a.currency, { hidden })} onPress={() => router.push(`/cuenta/${a.id}`)} />
            ))}
          </Card>
          {alerts.map((b) => <Banner key={b.category} kind="error" text={`Superaste tu presupuesto de ${b.category} (${money(b.used)} / ${money(b.limit)})`} />)}
          {bills.length ? (
            <Card>
              <Text variant="heading">Próximos vencimientos</Text>
              {bills.map((b) => <ListItem key={b.id} icon="alarm-outline" title={b.company} subtitle={`Vence ${date(b.dueDate)}`} right={money(b.amountDue)} onPress={() => router.push('/feature/pay-services')} />)}
            </Card>
          ) : null}
          <Card>
            {sectionHeader(t('recent'), () => router.push('/movimientos'))}
            {state.transactions.slice(0, 5).map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </Card>
        </Stack>
      </ScrollView>
    </SafeAreaView>
  );
}
