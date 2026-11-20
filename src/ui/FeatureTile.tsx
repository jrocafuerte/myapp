import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { featureById } from '../features/registry';
import { useBank } from '../store/BankContext';
import { T } from './kit';

/** Grilla de accesos a funcionalidades por id. */
export function FeatureGrid({ ids, columns = 4 }: { ids: string[]; columns?: number }) {
  const { colors } = useBank();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
      {ids.map((id) => {
        const f = featureById(id);
        if (!f) return null;
        return (
          <Pressable key={id} onPress={() => router.push(`/feature/${id}`)} accessibilityRole="button" accessibilityLabel={f.title}
            style={({ pressed }) => ({ width: `${100 / columns}%`, alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={f.icon} size={22} color={colors.primary} />
            </View>
            <T size={11} center weight="500" style={{ paddingHorizontal: 2 }}>{f.title}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
