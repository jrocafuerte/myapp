/**
 * Catálogo vivo del design system: muestra tokens y cada componente del contrato
 * con sus variantes. Sirve para revisar visualmente un adaptador nuevo (tu librería)
 * antes de usarlo en las 117 pantallas.
 */
import React, { useState } from 'react';
import {
  Avatar, Badge, Banner, BarList, Button, Card, Chips, ColumnChart, ConfirmButton, EmptyState, Icon, IconButton, Inline, Input,
  KeyValue, ListItem, Progress, Screen, Spinner, Stack, Stat, Surface, Swatch, Text, ToggleRow, avatarColors, useTheme,
  type ColorToken, type RadiusToken, type SpacingToken, type Tone, type TypographyToken,
} from '../ui/kit';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card><Text variant="headline">{title}</Text>{children}</Card>
);

export default function DesignSystemCatalog() {
  const t = useTheme();
  const [chip, setChip] = useState<'a' | 'b' | 'c'>('a');
  const [toggle, setToggle] = useState(true);
  const [input, setInput] = useState('');
  const [swatch, setSwatch] = useState<string>(avatarColors[0]);
  return (
    <Screen>
      <Banner kind="info" text={`Tema ${t.dark ? 'oscuro' : 'claro'}. Cambialo en Más → Tema oscuro para revisar ambos.`} />

      <Section title="Colores (roles)">
        {(Object.keys(t.colors) as ColorToken[]).map((role) => (
          <Inline key={role} gap="md">
            <Surface background={role} radius="sm" bordered padding="md"><Text variant="micro"> </Text></Surface>
            <Text flex weight="semibold">{role}</Text>
            <Text variant="caption" tone="muted" mono selectable>{t.colors[role]}</Text>
          </Inline>
        ))}
      </Section>

      <Section title="Tipografía">
        {(Object.keys(t.typography) as TypographyToken[]).map((v) => (
          <Stack key={v} gap="none">
            <Text variant="micro" tone="muted">{v} · {t.typography[v].fontSize}/{t.typography[v].lineHeight}</Text>
            <Text variant={v}>Banco Plus $1,234.56</Text>
          </Stack>
        ))}
      </Section>

      <Section title="Tonos de texto">
        <Inline gap="md" wrap>
          {(['default', 'muted', 'primary', 'success', 'danger', 'warning'] as Tone[]).map((tone) => <Text key={tone} tone={tone} weight="bold">{tone}</Text>)}
        </Inline>
        <Surface background="hero" padding="md" radius="md">
          <Inline gap="md" wrap>{(['inverse', 'onHero', 'highlight'] as Tone[]).map((tone) => <Text key={tone} tone={tone} weight="bold">{tone}</Text>)}</Inline>
        </Surface>
      </Section>

      <Section title="Espaciado">
        {(Object.keys(t.spacing) as SpacingToken[]).filter((s) => s !== 'none').map((s) => (
          <Inline key={s} gap="md">
            <Text variant="caption" tone="muted" mono>{s.padEnd(5)} {t.spacing[s]}</Text>
            <Inline gap={s}><Surface background="primary" radius="xs" padding="sm" /><Surface background="primary" radius="xs" padding="sm" /></Inline>
          </Inline>
        ))}
      </Section>

      <Section title="Radios">
        <Inline gap="md" wrap>
          {(Object.keys(t.radius) as RadiusToken[]).map((r) => (
            <Surface key={r} background="primarySoft" radius={r} padding="md" bordered><Text variant="caption">{r}</Text></Surface>
          ))}
        </Inline>
      </Section>

      <Section title="Elevación">
        <Inline gap="md">
          {(['none', 'sm', 'md'] as const).map((e) => <Surface key={e} background="card" elevation={e} padding="lg" radius="md" bordered><Text variant="caption">{e}</Text></Surface>)}
        </Inline>
      </Section>

      <Section title="Íconos">
        <Inline gap="lg">{(['sm', 'md', 'lg', 'xl'] as const).map((s) => <Icon key={s} name="card-outline" size={s} tone="primary" />)}</Inline>
      </Section>

      <Section title="Botones">
        <Button title="Primario" icon="paper-plane-outline" onPress={() => {}} />
        <Button title="Secundario" variant="secondary" onPress={() => {}} />
        <Button title="Peligro" variant="danger" onPress={() => {}} />
        <Button title="Fantasma" variant="ghost" onPress={() => {}} />
        <Button title="Deshabilitado" disabled onPress={() => {}} />
        <Button title="Cargando" loading onPress={() => {}} />
        <Inline gap="sm"><Button small title="Pequeño" onPress={() => {}} /><Button small variant="secondary" title="Pequeño" onPress={() => {}} /></Inline>
        <ConfirmButton title="Con confirmación" onConfirm={() => {}} />
        <Inline gap="sm"><IconButton icon="notifications-outline" badge={3} accessibilityLabel="Ejemplo" onPress={() => {}} /><Badge count={12} /><Spinner /></Inline>
      </Section>

      <Section title="Formularios">
        <Input label="Etiqueta" hint="Texto de ayuda" placeholder="Placeholder" value={input} onChangeText={setInput} />
        <Chips label="Chips" options={[{ label: 'Opción A', value: 'a' as const }, { label: 'Opción B', value: 'b' as const }, { label: 'Opción C', value: 'c' as const }]} value={chip} onChange={setChip} />
        <ToggleRow title="Interruptor" subtitle="Con subtítulo" value={toggle} onChange={setToggle} />
        <Inline gap="sm" wrap>{avatarColors.map((c, i) => <Swatch key={c} color={c} selected={swatch === c} accessibilityLabel={`Color ${i + 1}`} onPress={() => setSwatch(c)} />)}</Inline>
      </Section>

      <Section title="Listas y datos">
        <ListItem icon="wallet-outline" title="Elemento de lista" subtitle="Con subtítulo" right="$120.00" onPress={() => {}} />
        <ListItem icon="arrow-down-circle-outline" title="Monto positivo" right="+$50.00" rightTone="success" />
        <ListItem icon="warning-outline" title="Acción peligrosa" danger />
        <KeyValue k="Clave" v="Valor" />
        <Inline><Stat label="Estadística" value="$1,200" /><Stat label="Con tono" value="+4.2%" tone="success" /></Inline>
        {(['primary', 'success', 'warning', 'danger'] as const).map((tone, i) => <Progress key={tone} value={0.25 * (i + 1)} tone={tone} />)}
        <BarList data={[{ label: 'Supermercado', value: 320 }, { label: 'Transporte', value: 140 }, { label: 'Ocio', value: 60 }]} />
        <ColumnChart tones={['success', 'danger']} data={['ene', 'feb', 'mar', 'abr'].map((m, i) => ({ label: m, values: [300 + i * 40, 260 - i * 20] }))} />
      </Section>

      <Section title="Feedback">
        <Banner kind="info" text="Mensaje informativo" />
        <Banner kind="success" text="Operación realizada" />
        <Banner kind="error" text="Algo salió mal" />
        <EmptyState text="Estado vacío" icon="file-tray-outline" />
      </Section>

      <Section title="Avatares">
        <Inline gap="md">{(['sm', 'md', 'lg'] as const).map((s) => <Avatar key={s} initials="AG" color={swatch} size={s} />)}</Inline>
      </Section>
    </Screen>
  );
}
