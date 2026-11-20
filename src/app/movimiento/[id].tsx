import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { TxDetail } from '../../features/modules/accounts';

export default function TxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TxDetail txId={String(id)} />;
}
