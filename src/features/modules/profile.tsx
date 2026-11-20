import React, { useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Share } from 'react-native';
import * as L from '../../store/logic';
import { useBank } from '../../store/BankContext';
import type { AppNotification, Currency } from '../../store/types';
import {
  AccountPicker, Avatar, avatarColors, Banner, Button, Card, Chips, ConfirmButton, EmptyState, Inline, Input, KeyValue, ListItem, Screen, Stack, Surface, Swatch, Text, ToggleRow, useAction, useTheme,
} from '../../ui/kit';
import { date, money, parseAmount } from '../../utils/format';
import type { Feature } from '../types';

/* ----------------------------- Notificaciones ---------------------------- */
const kindIcon: Record<AppNotification['kind'], 'shield-outline' | 'swap-vertical-outline' | 'receipt-outline' | 'pricetag-outline' | 'information-circle-outline'> = {
  seguridad: 'shield-outline', movimiento: 'swap-vertical-outline', pago: 'receipt-outline', promo: 'pricetag-outline', sistema: 'information-circle-outline',
};

function NotificationCenter() {
  const { state, run } = useBank();
  const [kind, setKind] = useState<AppNotification['kind'] | 'todas'>('todas');
  const list = state.notifications.filter((n) => kind === 'todas' || n.kind === kind);
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Screen>
      <Chips options={[{ label: 'Todas', value: 'todas' as const }, ...(Object.keys(kindIcon) as AppNotification['kind'][]).map((k) => ({ label: k, value: k }))]} value={kind} onChange={setKind} />
      {unread ? <Button small title={`Marcar ${unread} como leídas`} variant="secondary" onPress={() => run((s) => L.markNotification(s, 'all'))} /> : null}
      <Card>
        {list.length === 0 ? <EmptyState text="Sin notificaciones" icon="notifications-off-outline" /> : list.slice(0, 80).map((n) => (
          <Inline key={n.id} align="center">
            <Stack flex>
              <ListItem icon={kindIcon[n.kind]} title={`${n.read ? '' : '● '}${n.title}`} subtitle={`${n.body}\n${date(n.date, true)}`} onPress={() => run((s) => L.markNotification(s, n.id))} />
            </Stack>
            <Button small title="✕" variant="ghost" onPress={() => run((s) => L.deleteNotification(s, n.id))} />
          </Inline>
        ))}
      </Card>
    </Screen>
  );
}

function NotifPrefs() {
  const { state, run } = useBank();
  return (
    <Screen>
      {(Object.keys(state.settings.notifPrefs) as AppNotification['kind'][]).map((k) => (
        <Card key={k}>
          <Text variant="heading">{k[0].toUpperCase() + k.slice(1)}</Text>
          {(['push', 'email', 'sms'] as const).map((ch) => (
            <ToggleRow key={ch} title={ch === 'push' ? 'Push' : ch === 'email' ? 'Email' : 'SMS'} value={state.settings.notifPrefs[k][ch]}
              onChange={(v) => run((s) => L.mut(s, (d) => { d.settings.notifPrefs[k][ch] = v; }))} />
          ))}
          {k === 'seguridad' ? <Text variant="caption" tone="muted">Las alertas de seguridad por push no pueden desactivarse completamente por tu protección.</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

function ThresholdAlert({ field, title, hint }: { field: 'lowBalanceThreshold' | 'largeTxThreshold'; title: string; hint: string }) {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [v, setV] = useState(String(state.settings[field]));
  return (
    <Screen><Card>
      <Text variant="heading">{title}</Text>
      <Text tone="muted" variant="bodySmall">{hint}</Text>
      <KeyValue k="Valor actual" v={money(state.settings[field])} />
      <Input label="Nuevo umbral" value={v} onChangeText={setV} keyboardType="decimal-pad" />
      {feedback}
      <Button title="Guardar" onPress={() => exec((s) => L.mut(s, (d) => { const n = parseAmount(v); if (!(n >= 0)) throw new L.BankError('Monto inválido.'); d.settings[field] = n; }), 'Alerta actualizada.')} />
    </Card></Screen>
  );
}

function Inbox() {
  const { state, run } = useBank();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      {state.inbox.map((m) => (
        <Card key={m.id}>
          <ListItem icon={m.read ? 'mail-open-outline' : 'mail-unread-outline'} title={m.subject} subtitle={date(m.date)} onPress={() => { setOpen(open === m.id ? null : m.id); run((s) => L.readMessage(s, m.id)); }} />
          {open === m.id ? <Text>{m.body}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

function Offers() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  return (
    <Screen>
      {feedback}
      {state.offers.map((o) => (
        <Card key={o.id}>
          <Text variant="heading">{o.title}</Text>
          <Text tone="muted">{o.description}</Text>
          {o.accepted ? <Banner kind="success" text="Oferta activada" /> : <Button small title="Activar oferta" onPress={() => exec((s) => L.acceptOffer(s, o.id), '¡Oferta activada!')} />}
        </Card>
      ))}
    </Screen>
  );
}

/* --------------------------------- Perfil -------------------------------- */
/** Avatar del usuario actual (iniciales + color elegido). */
export function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { state } = useBank();
  const initials = state.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <Avatar initials={initials} color={state.user.avatarColor} size={size} />;
}

function Profile() {
  const { state, run } = useBank();
  const { exec, feedback } = useAction();
  const [f, setF] = useState({ name: state.user.name, email: state.user.email, phone: state.user.phone, address: state.user.address });
  return (
    <Screen>
      <Card align="center">
        <UserAvatar size="lg" />
        <Inline gap="sm" justify="center" wrap>
          {avatarColors.map((c, i) => (
            <Swatch key={c} color={c} selected={state.user.avatarColor === c} accessibilityLabel={`Color de avatar ${i + 1}`}
              onPress={() => run((s) => L.mut(s, (d) => { d.user.avatarColor = c; }))} />
          ))}
        </Inline>
      </Card>
      <Card>
        <Input label="Nombre completo" value={f.name} onChangeText={(name) => setF({ ...f, name })} />
        <Input label="Email" value={f.email} onChangeText={(email) => setF({ ...f, email })} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Teléfono" value={f.phone} onChangeText={(phone) => setF({ ...f, phone })} keyboardType="phone-pad" />
        <Input label="Dirección" value={f.address} onChangeText={(address) => setF({ ...f, address })} />
        <KeyValue k="Documento" v={state.user.documentId} />
        <KeyValue k="Fecha de nacimiento" v={date(state.user.birthDate)} />
        {feedback}
        <Button title="Guardar cambios" onPress={() => exec((s) => L.updateProfile(s, f), 'Perfil actualizado.')} />
      </Card>
    </Screen>
  );
}

function SettingChips<V extends string>({ title, field, options }: { title: string; field: 'language' | 'darkMode' | 'displayCurrency'; options: { label: string; value: V }[] }) {
  const { state, run } = useBank();
  return (
    <Screen><Card>
      <Text variant="heading">{title}</Text>
      <Chips options={options} value={state.settings[field] as V} onChange={(v) => run((s) => L.mut(s, (d) => { (d.settings as unknown as Record<string, string>)[field] = v; }))} />
    </Card></Screen>
  );
}

function Documents() {
  const { state } = useBank();
  const docs = [
    { t: 'Términos y condiciones generales', b: 'Contrato de apertura y uso de productos de Banco Plus. Versión 2026.' },
    { t: 'Contrato de tarjeta de crédito', b: `Límite ${money(state.cards.find((c) => c.kind === 'credito')?.limit ?? 0)}. TNA financiación 45%.` },
    { t: 'Política de privacidad', b: 'Cómo tratamos y protegemos tus datos personales.' },
    ...state.loans.map((l) => ({ t: `Contrato préstamo ${l.kind}`, b: `Capital ${money(l.principal)} a ${l.months} meses, TNA ${l.rate}%. Firmado ${date(l.startDate)}.` })),
    ...state.insurances.map((i) => ({ t: `Póliza seguro de ${i.type}`, b: `Cobertura ${money(i.coverage)}, prima ${money(i.premium)}/mes.` })),
  ];
  return (
    <Screen>
      {docs.map((d) => (
        <Card key={d.t}>
          <ListItem icon="document-text-outline" title={d.t} subtitle={d.b} />
          <Button small title="Compartir" variant="secondary" icon="share-outline" onPress={() => Share.share({ message: `${d.t}\n\n${d.b}` }).catch(() => {})} />
        </Card>
      ))}
    </Screen>
  );
}

function Rewards() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [acc, setAcc] = useState(state.accounts.find((a) => a.isPrimary)?.id);
  return (
    <Screen>
      <Card align="center">
        <Text tone="muted">Tus puntos</Text>
        <Text variant="display" weight="heavy">{state.user.points.toLocaleString('es')}</Text>
        <Text variant="caption" tone="muted" align="center">Sumás 1 punto por dólar en compras con tarjeta y QR, y 0.5 en pagos de servicios.</Text>
      </Card>
      <AccountPicker label="Acreditar créditos en" value={acc} onChange={setAcc} />
      {feedback}
      {state.rewards.map((r) => (
        <Card key={r.id}>
          <ListItem icon="gift-outline" title={r.name} right={`${r.points} pts`} />
          <Button small title="Canjear" disabled={state.user.points < r.points} onPress={() => exec((s) => L.redeemReward(s, r.id, acc!), `Canjeaste ${r.name}.`)} />
        </Card>
      ))}
    </Screen>
  );
}

function Referrals() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [name, setName] = useState('');
  const msg = `Abrí tu cuenta en Banco Plus con mi código ${state.user.referralCode} y ganá 500 puntos 🎁`;
  return (
    <Screen>
      <Card align="center">
        <Text tone="muted">Tu código</Text>
        <Text variant="title" weight="heavy" selectable>{state.user.referralCode}</Text>
        <Button title="Compartir invitación" icon="share-social-outline" onPress={() => Share.share({ message: msg }).catch(() => {})} />
      </Card>
      <Card>
        <Text variant="heading">Registrar invitado</Text>
        <Input label="Nombre" value={name} onChangeText={setName} />
        {feedback}
        <Button title="Registrar (+500 pts)" variant="secondary" onPress={() => { if (exec((s) => L.addReferral(s, name), '¡Sumaste 500 puntos!')) setName(''); }} />
        {state.user.referrals.map((r) => <ListItem key={r} icon="person-outline" title={r} subtitle="Invitación aceptada" />)}
      </Card>
    </Screen>
  );
}

/* --------------------------------- Soporte ------------------------------- */
const FAQ = [
  { q: '¿Cómo bloqueo mi tarjeta?', a: 'En Tarjetas, tocá la tarjeta y activá "Bloqueo temporal". Si fue robada, usá "Denuncia por robo o pérdida".' },
  { q: '¿Cuánto tarda una transferencia?', a: 'Entre cuentas de Banco Plus es inmediata. A otros bancos, hasta 1 hora hábil. Internacionales: 1 a 3 días hábiles.' },
  { q: '¿Cómo cambio mis límites?', a: 'Desde Transferencias → Límites de transferencia. Montos altos requieren token digital.' },
  { q: '¿Qué hago si no reconozco un movimiento?', a: 'Abrí el movimiento, compartí el comprobante y creá un ticket de soporte. Si sospechás fraude, activá el bloqueo de emergencia.' },
  { q: '¿Cómo funciona el redondeo?', a: 'Cada compra se redondea al dólar siguiente y la diferencia se envía a la meta que elijas.' },
  { q: '¿Mis datos están seguros?', a: 'Usamos 2FA, token digital, biometría y cierre automático de sesión. Nunca te pediremos tu contraseña por teléfono o email.' },
];
function HelpFaq() {
  const [q, setQ] = useState(''); const [open, setOpen] = useState<number | null>(null);
  const list = FAQ.filter((f) => (f.q + f.a).toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen>
      <Input placeholder="Buscar en la ayuda" value={q} onChangeText={setQ} />
      {list.length === 0 ? <EmptyState text="Sin resultados. Probá el asistente virtual." /> : list.map((f, i) => (
        <Card key={f.q}>
          <ListItem icon="help-circle-outline" title={f.q} onPress={() => setOpen(open === i ? null : i)} />
          {open === i ? <Text>{f.a}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

function Chatbot() {
  const { state } = useBank();
  const { colors } = useTheme();
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([{ me: false, text: L.assistantReply(state, 'hola') }]);
  const [text, setText] = useState('');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const send = (t = text) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { me: true, text: t }, { me: false, text: L.assistantReply(state, t) }]);
    setText('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };
  return (
    <Stack flex background="bg">
      <ScrollView ref={scroll} style={{ backgroundColor: colors.bg }}>
        <Stack padding="lg" gap="sm">
          {msgs.map((m, i) => (
            <Surface key={i} alignSelf={m.me ? 'end' : 'start'} maxWidth="85%" background={m.me ? 'primary' : 'card'} bordered={!m.me} radius="md" padding="md">
              <Text tone={m.me ? 'onPrimary' : 'default'}>{m.text}</Text>
            </Surface>
          ))}
        </Stack>
      </ScrollView>
      <Surface padding="md" gap="sm" background="card" bordered radius="none">
        <Inline gap="sm" wrap>
          {['¿Cuál es mi saldo?', '¿En qué gasto más?', 'Próximo vencimiento', 'Hablar con un asesor'].map((s) => <Button key={s} small variant="secondary" title={s} onPress={() => send(s)} />)}
        </Inline>
        <Inline gap="sm" align="center">
          <Stack flex><Input value={text} onChangeText={setText} placeholder="Escribí tu consulta" onSubmitEditing={() => send()} returnKeyType="send" /></Stack>
          <Button small title="Enviar" icon="send" onPress={() => send()} />
        </Inline>
      </Surface>
    </Stack>
  );
}

function SupportTicket() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [subject, setSubject] = useState(''); const [cat, setCat] = useState('Tarjetas'); const [desc, setDesc] = useState('');
  return (
    <Screen>
      <Card>
        <Text variant="heading">Nuevo ticket</Text>
        <Chips label="Categoría" options={['Tarjetas', 'Transferencias', 'Cuentas', 'Fraude', 'App', 'Otro'].map((c) => ({ label: c, value: c }))} value={cat} onChange={setCat} />
        <Input label="Asunto" value={subject} onChangeText={setSubject} />
        <Input label="Descripción" value={desc} onChangeText={setDesc} multiline />
        {feedback}
        <Button title="Enviar ticket" onPress={() => { if (exec((s) => L.createTicket(s, subject, cat, desc), 'Ticket creado. Respondemos en menos de 24 h.')) { setSubject(''); setDesc(''); } }} />
      </Card>
      <Card>
        <Text variant="heading">Mis tickets</Text>
        {state.tickets.length === 0 ? <EmptyState text="Sin tickets" /> : state.tickets.map((t) => <ListItem key={t.id} icon="chatbubbles-outline" title={`${t.id} · ${t.subject}`} subtitle={`${t.category} · ${date(t.date)} · ${t.status}`} />)}
      </Card>
    </Screen>
  );
}

const BRANCHES = [
  { name: 'Sucursal Centro', type: 'sucursal', address: 'Av. Principal 450', hours: 'L-V 9:00–17:00', km: 0.8, lat: -0.1807, lng: -78.4678 },
  { name: 'Cajero Plaza Norte', type: 'cajero', address: 'C.C. Plaza Norte, local 12', hours: '24 h', km: 1.4, lat: -0.1602, lng: -78.4801 },
  { name: 'Sucursal Parque', type: 'sucursal', address: 'Calle del Parque 88', hours: 'L-V 9:00–16:00 · S 9:00–13:00', km: 2.9, lat: -0.2011, lng: -78.4912 },
  { name: 'Cajero Terminal', type: 'cajero', address: 'Terminal de buses, acceso 2', hours: '24 h', km: 4.2, lat: -0.2252, lng: -78.5123 },
  { name: 'Cajero Universidad', type: 'cajero', address: 'Campus central, edificio A', hours: '6:00–22:00', km: 5.1, lat: -0.1995, lng: -78.5051 },
];
function BranchLocator() {
  const [type, setType] = useState<'todos' | 'sucursal' | 'cajero'>('todos');
  return (
    <Screen>
      <Chips options={[{ label: 'Todos', value: 'todos' as const }, { label: 'Sucursales', value: 'sucursal' as const }, { label: 'Cajeros', value: 'cajero' as const }]} value={type} onChange={setType} />
      {BRANCHES.filter((b) => type === 'todos' || b.type === type).map((b) => (
        <Card key={b.name}>
          <ListItem icon={b.type === 'cajero' ? 'cash-outline' : 'business-outline'} title={b.name} subtitle={`${b.address}\n${b.hours}`} right={`${b.km} km`} />
          <Button small title="Cómo llegar" icon="navigate-outline" variant="secondary" onPress={() => Linking.openURL(Platform.OS === 'ios' ? `maps://?q=${encodeURIComponent(b.name)}&ll=${b.lat},${b.lng}` : `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`).catch(() => {})} />
        </Card>
      ))}
    </Screen>
  );
}

function EmergencyContacts() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [rel, setRel] = useState('');
  return (
    <Screen>
      <Card>
        <Text variant="heading">Líneas del banco</Text>
        <ListItem icon="call-outline" title="Robo o pérdida de tarjetas (24 h)" subtitle="0800-222-7777" onPress={() => Linking.openURL('tel:08002227777').catch(() => {})} />
        <ListItem icon="call-outline" title="Atención al cliente" subtitle="0800-BANCO-PLUS" onPress={() => Linking.openURL('tel:08002262675').catch(() => {})} />
      </Card>
      <Card>
        <Text variant="heading">Mis contactos de emergencia</Text>
        {state.emergencyContacts.map((c) => (
          <Inline key={c.id} align="center">
            <Stack flex><ListItem icon="person-outline" title={`${c.name} (${c.relation})`} subtitle={c.phone} onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})} /></Stack>
            <ConfirmButton small title="✕" variant="ghost" confirmText="¿Quitar?" onConfirm={() => exec((s) => L.removeEmergencyContact(s, c.id), 'Contacto eliminado.')} />
          </Inline>
        ))}
        <Input label="Nombre" value={name} onChangeText={setName} />
        <Input label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Relación" value={rel} onChangeText={setRel} placeholder="Familiar, amigo…" />
        {feedback}
        <Button title="Agregar contacto" variant="secondary" onPress={() => { if (exec((s) => L.addEmergencyContact(s, name, phone, rel), 'Contacto agregado.')) { setName(''); setPhone(''); setRel(''); } }} />
      </Card>
    </Screen>
  );
}

export const profileFeatures: Feature[] = [
  { id: 'notification-center', module: 'notificaciones', title: 'Centro de notificaciones', description: 'Filtrá, leé y borrá', icon: 'notifications-outline', Component: NotificationCenter },
  { id: 'notif-prefs', module: 'notificaciones', title: 'Preferencias de aviso', description: 'Push, email y SMS por tipo', icon: 'options-outline', Component: NotifPrefs },
  { id: 'low-balance-alert', module: 'notificaciones', title: 'Alerta de saldo bajo', description: 'Avisá cuando baje de un monto', icon: 'trending-down-outline', Component: () => <ThresholdAlert field="lowBalanceThreshold" title="Alerta de saldo bajo" hint="Te avisamos cuando una cuenta queda por debajo de este saldo." /> },
  { id: 'large-tx-alert', module: 'notificaciones', title: 'Alerta de movimientos grandes', description: 'Detectá operaciones inusuales', icon: 'pulse-outline', Component: () => <ThresholdAlert field="largeTxThreshold" title="Alerta de movimientos grandes" hint="Te avisamos de cada ingreso o egreso igual o mayor a este monto." /> },
  { id: 'inbox', module: 'notificaciones', title: 'Buzón de mensajes', description: 'Comunicaciones del banco', icon: 'mail-outline', Component: Inbox },
  { id: 'offers', module: 'notificaciones', title: 'Ofertas personalizadas', description: 'Beneficios para vos', icon: 'pricetag-outline', Component: Offers },

  { id: 'profile', module: 'perfil', title: 'Mi perfil', description: 'Datos personales y avatar', icon: 'person-circle-outline', Component: Profile },
  { id: 'language', module: 'perfil', title: 'Idioma', description: 'Español / English', icon: 'language-outline', Component: () => <SettingChips title="Idioma" field="language" options={[{ label: 'Español', value: 'es' }, { label: 'English', value: 'en' }]} /> },
  { id: 'dark-mode', module: 'perfil', title: 'Tema oscuro', description: 'Claro, oscuro o del sistema', icon: 'moon-outline', Component: () => <SettingChips title="Apariencia" field="darkMode" options={[{ label: 'Sistema', value: 'sistema' }, { label: 'Claro', value: 'claro' }, { label: 'Oscuro', value: 'oscuro' }]} /> },
  { id: 'display-currency', module: 'perfil', title: 'Moneda de visualización', description: 'Para tu saldo total', icon: 'cash-outline', Component: () => <SettingChips title="Mostrar saldo total en" field="displayCurrency" options={(['USD', 'EUR', 'GBP'] as Currency[]).map((c) => ({ label: c, value: c }))} /> },
  { id: 'documents', module: 'perfil', title: 'Documentos y contratos', description: 'Tus contratos y pólizas', icon: 'folder-outline', Component: Documents },
  { id: 'rewards', module: 'perfil', title: 'Puntos y recompensas', description: 'Sumá y canjeá', icon: 'gift-outline', Component: Rewards },
  { id: 'referrals', module: 'perfil', title: 'Invitá amigos', description: 'Ganá 500 puntos por invitado', icon: 'people-circle-outline', Component: Referrals },

  { id: 'help-faq', module: 'soporte', title: 'Centro de ayuda', description: 'Preguntas frecuentes', icon: 'help-circle-outline', Component: HelpFaq },
  { id: 'chatbot', module: 'soporte', title: 'Asistente virtual', description: 'Respuestas con tus datos', icon: 'chatbubble-ellipses-outline', Component: Chatbot },
  { id: 'support-ticket', module: 'soporte', title: 'Tickets de soporte', description: 'Creá y seguí reclamos', icon: 'construct-outline', Component: SupportTicket },
  { id: 'branch-locator', module: 'soporte', title: 'Sucursales y cajeros', description: 'Encontrá el más cercano', icon: 'location-outline', Component: BranchLocator },
  { id: 'emergency-contacts', module: 'soporte', title: 'Contactos de emergencia', description: 'Líneas 24 h y tus contactos', icon: 'call-outline', Component: EmergencyContacts },
];
