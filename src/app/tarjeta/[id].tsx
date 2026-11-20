import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { CardDetail } from '../../features/modules/cards';

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardDetail cardId={String(id)} />;
}
