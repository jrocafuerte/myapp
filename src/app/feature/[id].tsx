import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { featureById } from '../../features/registry';
import { Empty, Screen } from '../../ui/kit';

export default function FeatureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feature = featureById(String(id));
  if (!feature) return <Screen><Stack.Screen options={{ title: 'No encontrado' }} /><Empty text="Funcionalidad no encontrada" /></Screen>;
  const { Component } = feature;
  return (<><Stack.Screen options={{ title: feature.title }} /><Component /></>);
}
