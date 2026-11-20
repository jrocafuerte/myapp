import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { AccountDetail } from '../../features/modules/accounts';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountDetail accountId={String(id)} />;
}
