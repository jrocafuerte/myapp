import { router } from 'expo-router';
import React, { useState } from 'react';
import { UserAvatar } from '../../features/modules/profile';
import { useCatalog } from '../../features/registry';
import { useBank } from '../../store/BankContext';
import {
  Button, Card, ConfirmButton, EmptyState, Icon, Inline, Input, ListItem, Screen, Stack, Text,
} from '../../ui/kit';
import { useT } from '../../utils/i18n';

export default function More() {
  const { state, signOut, reset } = useBank();
  const t = useT();
  const [q, setQ] = useState('');
  const catalog = useCatalog();
  const query = q.trim().toLowerCase();
  const groups = catalog.modules.map((g) => ({ ...g, features: g.features.filter((f) => !query || `${f.title} ${f.description} ${g.title}`.toLowerCase().includes(query)) })).filter((g) => g.features.length);
  return (
    <Screen>
      <Card>
        <Inline gap="md">
          <UserAvatar size="sm" />
          <Stack flex><ListItem title={state.user.name} subtitle={state.user.email} onPress={() => router.push('/feature/profile')} /></Stack>
        </Inline>
      </Card>
      <Input placeholder={`${t('search')} entre ${catalog.count} funcionalidades`} value={q} onChangeText={setQ} />
      {groups.length === 0 ? <EmptyState text="Sin resultados" icon="search-outline" /> : groups.map((g) => (
        <Card key={g.module}>
          <Inline gap="sm">
            <Icon name={g.icon} size="md" tone="primary" />
            <Text variant="heading">{g.title}</Text>
            <Text tone="muted" variant="caption">({g.features.length})</Text>
          </Inline>
          {g.features.map((f) => <ListItem key={f.id} icon={f.icon} title={f.title} subtitle={f.maintenance ? `En mantenimiento · ${f.description}` : f.description} onPress={() => router.push(`/feature/${f.id}`)} />)}
        </Card>
      ))}
      <Button title={t('logout')} icon="log-out-outline" variant="secondary" onPress={() => { signOut(); router.replace('/login'); }} />
      <ConfirmButton title="Restablecer datos de demostración" variant="ghost" onConfirm={reset} />
      <Button title="Design system (catálogo)" icon="color-palette-outline" variant="ghost" onPress={() => router.push('/design-system')} />
      <Text variant="micro" tone="muted" align="center">Banco Plus · v1.0.0 · {catalog.count} funcionalidades</Text>
    </Screen>
  );
}
