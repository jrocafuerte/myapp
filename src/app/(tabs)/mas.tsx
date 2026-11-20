import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '../../features/modules/profile';
import { FEATURES, featuresByModule } from '../../features/registry';
import { useBank } from '../../store/BankContext';
import { Button, Card, ConfirmButton, Empty, H, Input, Row, Screen, T } from '../../ui/kit';
import { useT } from '../../utils/i18n';

export default function More() {
  const { state, colors, setAuthenticated, reset } = useBank();
  const t = useT();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const groups = featuresByModule().map((g) => ({ ...g, features: g.features.filter((f) => !query || `${f.title} ${f.description} ${g.title}`.toLowerCase().includes(query)) })).filter((g) => g.features.length);
  return (
    <Screen>
      <Card>
        <Row title={state.user.name} subtitle={state.user.email} onPress={() => router.push('/feature/profile')} />
        <View style={{ position: 'absolute', right: 48, top: 16 }}><Avatar size={36} /></View>
      </Card>
      <Input placeholder={`${t('search')} entre ${FEATURES.length} funcionalidades`} value={q} onChangeText={setQ} />
      {groups.length === 0 ? <Empty text="Sin resultados" icon="search-outline" /> : groups.map((g) => (
        <Card key={g.module}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={g.icon} size={18} color={colors.primary} />
            <H>{g.title}</H>
            <T muted size={12}>({g.features.length})</T>
          </View>
          {g.features.map((f) => <Row key={f.id} icon={f.icon} title={f.title} subtitle={f.description} onPress={() => router.push(`/feature/${f.id}`)} />)}
        </Card>
      ))}
      <Button title={t('logout')} icon="log-out-outline" variant="secondary" onPress={() => { setAuthenticated(false); router.replace('/login'); }} />
      <ConfirmButton title="Restablecer datos de demostración" variant="ghost" onConfirm={reset} />
      <T size={11} muted center>Banco Plus · v1.0.0 · {FEATURES.length} funcionalidades</T>
    </Screen>
  );
}
