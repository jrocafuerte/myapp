import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TxRow } from '../../features/modules/accounts';
import { Avatar } from '../../features/modules/profile';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import { FeatureGrid } from '../../ui/FeatureTile';
import { Banner, Card, H, Row, T } from '../../ui/kit';
import { date, money } from '../../utils/format';
import { useT } from '../../utils/i18n';

export default function Home() {
  const { state, colors, run, touch } = useBank();
  const t = useT();
  const cur = state.settings.displayCurrency; const hidden = state.settings.hideBalances;
  const unread = state.notifications.filter((n) => !n.read).length;
  const alerts = L.budgetStatus(state).filter((b) => b.over);
  const bills = state.services.filter((s) => s.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 2);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.hero }}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }} onTouchStart={touch}>
        <View style={{ backgroundColor: colors.hero, padding: 20, paddingBottom: 36, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={() => router.push('/feature/profile')}><Avatar size={44} /></Pressable>
            <View style={{ flex: 1 }}>
              <T color={colors.heroText} size={13}>{t('hello')},</T>
              <T color="#fff" size={18} weight="700">{state.user.name.split(' ')[0]}</T>
            </View>
            <Pressable accessibilityLabel="Ocultar saldos" onPress={() => run((s) => L.mut(s, (d) => { d.settings.hideBalances = !d.settings.hideBalances; }))} hitSlop={10}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={24} color="#fff" />
            </Pressable>
            <Pressable accessibilityLabel="Notificaciones" onPress={() => router.push('/feature/notification-center')} hitSlop={10}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              {unread ? <View style={{ position: 'absolute', right: -4, top: -4, backgroundColor: colors.danger, borderRadius: 8, minWidth: 16, alignItems: 'center' }}><T size={10} color="#fff" weight="700">{unread}</T></View> : null}
            </Pressable>
          </View>
          {state.settings.quickBalanceWidget ? (
            <Pressable onPress={() => router.push('/feature/balance-summary')}>
              <T color={colors.heroText}>{t('total')} ({cur})</T>
              <T color="#fff" size={34} weight="800">{money(L.totalBalance(state, cur), cur, { hidden })}</T>
            </Pressable>
          ) : null}
        </View>
        <View style={{ padding: 16, gap: 12, marginTop: -24 }}>
          {state.user.emergencyLocked ? <Banner kind="error" text="Bloqueo de emergencia activo. Tocá Más → Bloqueo de emergencia para desbloquear." /> : null}
          <Card>
            <FeatureGrid ids={['transfer-third', 'pay-services', 'receive-qr', 'pay-qr', 'mobile-topup', 'savings-goals', 'loan-simulator', 'chatbot']} />
          </Card>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><H>{t('accounts')}</H><Pressable onPress={() => router.push('/feature/accounts-list')}><T color={colors.primary} weight="600">{t('seeAll')}</T></Pressable></View>
            {state.accounts.filter((a) => !a.closed).map((a) => (
              <Row key={a.id} icon="wallet-outline" title={`${a.alias}${a.isPrimary ? ' ★' : ''}`} subtitle={a.number} right={money(a.balance, a.currency, { hidden })} onPress={() => router.push(`/cuenta/${a.id}`)} />
            ))}
          </Card>
          {alerts.map((b) => <Banner key={b.category} kind="error" text={`Superaste tu presupuesto de ${b.category} (${money(b.used)} / ${money(b.limit)})`} />)}
          {bills.length ? (
            <Card>
              <H>Próximos vencimientos</H>
              {bills.map((b) => <Row key={b.id} icon="alarm-outline" title={b.company} subtitle={`Vence ${date(b.dueDate)}`} right={money(b.amountDue)} onPress={() => router.push('/feature/pay-services')} />)}
            </Card>
          ) : null}
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><H>{t('recent')}</H><Pressable onPress={() => router.push('/movimientos')}><T color={colors.primary} weight="600">{t('seeAll')}</T></Pressable></View>
            {state.transactions.slice(0, 5).map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
