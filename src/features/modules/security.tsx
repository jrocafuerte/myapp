import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as L from '../../store/logic';
import { cmd } from '../../store/commands';
import { useBank } from '../../store/BankContext';
import {
  Banner, Button, Card, Chips, ConfirmButton, EmptyState, Input, KeyValue, ListItem, Screen, Stack, Text, ToggleRow, useAction,
} from '../../ui/kit';
import { date } from '../../utils/format';
import { gateway } from '../../api/gateway';
import type { Feature } from '../types';

function SessionInfo() {
  const { state, signOut } = useBank();
  const last = state.loginHistory.find((l) => l.success);
  return (
    <Screen>
      <Card>
        <Text variant="heading">Sesión activa</Text>
        <KeyValue k="Usuario" v={state.user.username} />
        <KeyValue k="Último acceso" v={last ? date(last.date, true) : '—'} />
        <KeyValue k="Método" v={last?.method ?? '—'} />
        <Text variant="bodySmall" tone="muted">El inicio de sesión valida usuario y contraseña, registra el intento y alerta los fallidos.</Text>
      </Card>
      <Button title="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={() => { signOut(); router.replace('/login'); }} />
    </Screen>
  );
}

function Biometric() {
  const { state, run } = useBank();
  const [info, setInfo] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return setAvailable(false);
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setAvailable(hw && enrolled);
    })();
  }, []);
  const toggle = async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirmá tu identidad' });
      if (!r.success) return setInfo('No se pudo verificar la biometría.');
    }
    run(cmd.updatePreferences({ biometricEnabled: on }));
    setInfo(on ? 'Ingreso biométrico activado.' : 'Ingreso biométrico desactivado.');
  };
  return (
    <Screen>
      <Card>
        <Text variant="heading">Huella / Face ID</Text>
        {available === false ? <Banner kind="info" text="Este dispositivo no tiene biometría configurada (o estás en web)." /> : null}
        <ToggleRow title="Ingresar con biometría" subtitle="Se pedirá en la pantalla de acceso" value={state.settings.biometricEnabled}
          onChange={(v) => { if (available) toggle(v); }} />
        <Banner kind="success" text={info} />
      </Card>
    </Screen>
  );
}

function QuickPin() {
  const { state, run } = useBank();
  const { exec, feedback } = useAction();
  const [pin, setPin] = useState(''); const [confirm, setConfirm] = useState('');
  return (
    <Screen>
      <Card>
        <Text variant="heading">PIN de acceso rápido</Text>
        <Text tone="muted" variant="bodySmall">{state.settings.pin ? 'Ya tenés un PIN configurado. Podés reemplazarlo o eliminarlo.' : 'Ingresá con un PIN de 4 a 6 dígitos sin escribir tu contraseña.'}</Text>
        <Input label="Nuevo PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
        <Input label="Repetir PIN" value={confirm} onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={6} />
        {feedback}
        <Button title="Guardar PIN" onPress={async () => { if (await exec(cmd.setPin(pin, confirm), 'PIN guardado.')) { setPin(''); setConfirm(''); } }} />
        {state.settings.pin ? <Button title="Eliminar PIN" variant="ghost" onPress={() => run(cmd.removePin())} /> : null}
      </Card>
    </Screen>
  );
}

function ChangePassword() {
  const { state, replace } = useBank();
  const { exec, feedback } = useAction();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [conf, setConf] = useState('');
  const strength = [next.length >= 8, /\d/.test(next), /[A-Z]/.test(next), /[^a-zA-Z0-9]/.test(next)].filter(Boolean).length;
  return (
    <Screen>
      <Card>
        <Text variant="heading">Cambiar contraseña</Text>
        <Input label="Contraseña actual" value={cur} onChangeText={setCur} secureTextEntry />
        <Input label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry hint={`Fortaleza: ${['muy débil', 'débil', 'media', 'buena', 'excelente'][strength]}`} />
        <Input label="Confirmar nueva contraseña" value={conf} onChangeText={setConf} secureTextEntry />
        {feedback}
        <Button title="Actualizar" onPress={async () => { if (await exec(async () => replace(await gateway.changePassword(state, cur, next, conf)), 'Contraseña actualizada.')) { setCur(''); setNext(''); setConf(''); } }} />
      </Card>
    </Screen>
  );
}

function TwoFactor() {
  const { state, run } = useBank();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Autenticación en dos pasos</Text>
        <ToggleRow title="2FA activado" subtitle="Pedimos tu token digital para operaciones sensibles y nuevos dispositivos"
          value={state.settings.twoFactor} onChange={(v) => run(cmd.updatePreferences({ twoFactor: v }))} />
        {!state.settings.twoFactor ? <Banner kind="error" text="Recomendamos mantener el 2FA activado." /> : null}
      </Card>
    </Screen>
  );
}

function OtpToken() {
  const { state } = useBank();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const remaining = 30 - Math.floor((now / 1000) % 30);
  return (
    <Screen>
      <Card align="center">
        <Text variant="heading">Token digital</Text>
        <Text variant="display" weight="heavy" letterSpacing="code" selectable>{L.otpCode(state.user.username, now)}</Text>
        <Text tone="muted">Se renueva en {remaining} s</Text>
        <Text variant="caption" tone="muted" align="center">Usalo para confirmar transferencias a nuevos destinatarios, cambios de límites y nuevos dispositivos. Nunca lo compartas.</Text>
      </Card>
    </Screen>
  );
}

function AutoLock() {
  const { state, run } = useBank();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Cierre de sesión automático</Text>
        <Text tone="muted" variant="bodySmall">La sesión se cierra tras este tiempo sin actividad o en segundo plano.</Text>
        <Chips options={[1, 2, 5, 10, 15].map((m) => ({ label: `${m} min`, value: m }))} value={state.settings.autoLockMinutes}
          onChange={(m) => run(cmd.updatePreferences({ autoLockMinutes: m }))} />
      </Card>
    </Screen>
  );
}

function Devices() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  return (
    <Screen>
      {feedback}
      {state.devices.map((d) => (
        <Card key={d.id}>
          <ListItem icon={d.current ? 'phone-portrait' : 'desktop-outline'} title={d.name} subtitle={`Activo: ${date(d.lastActive, true)}${d.current ? ' · actual' : ''}`} />
          {!d.current ? <ConfirmButton small title="Desvincular" variant="secondary" onConfirm={() => exec(cmd.revokeDevice(d.id), 'Dispositivo desvinculado.')} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

function LoginHistory() {
  const { state } = useBank();
  return (
    <Screen>
      <Card>
        {state.loginHistory.length === 0 ? <EmptyState text="Sin accesos registrados" /> : state.loginHistory.slice(0, 50).map((l) => (
          <ListItem key={l.id} icon={l.success ? 'checkmark-circle-outline' : 'close-circle-outline'} danger={!l.success}
            title={l.success ? 'Acceso exitoso' : 'Intento fallido'} subtitle={`${date(l.date, true)} · ${l.device} · ${l.method}`}
            right={l.success ? '' : '⚠'} rightTone={'danger'} />
        ))}
      </Card>
    </Screen>
  );
}

const QUESTIONS = ['¿Nombre de tu primera mascota?', '¿Ciudad donde naciste?', '¿Nombre de tu escuela primaria?', '¿Comida favorita?'];
function SecurityQuestions() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <Screen>
      <Card>
        <Text variant="heading">Preguntas de seguridad</Text>
        <Text tone="muted" variant="bodySmall">{state.settings.securityQuestions.length ? `Configuradas: ${state.settings.securityQuestions.length}. Completá para reemplazarlas.` : 'Se usan para recuperar el acceso. Respondé al menos dos.'}</Text>
        {QUESTIONS.map((q) => <Input key={q} label={q} value={answers[q] ?? ''} onChangeText={(v) => setAnswers({ ...answers, [q]: v })} />)}
        {feedback}
        <Button title="Guardar" onPress={() => exec(cmd.setSecurityQuestions(Object.entries(answers).filter(([, a]) => a.trim()).map(([question, answer]) => ({ question, answer }))), 'Preguntas guardadas.')} />
      </Card>
    </Screen>
  );
}

function PrivacyMode() {
  const { state, run } = useBank();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Modo privacidad</Text>
        <ToggleRow title="Ocultar saldos" subtitle="Muestra •••• en lugar de los montos en toda la app" value={state.settings.hideBalances}
          onChange={(v) => run(cmd.updatePreferences({ hideBalances: v }))} />
        <ToggleRow title="Saldo rápido en inicio" subtitle="Mostrar la tarjeta de saldo total en el inicio" value={state.settings.quickBalanceWidget}
          onChange={(v) => run(cmd.updatePreferences({ quickBalanceWidget: v }))} />
      </Card>
    </Screen>
  );
}

function EmergencyLock() {
  const { state } = useBank();
  const { exec, feedback } = useAction();
  const [pwd, setPwd] = useState('');
  const locked = state.user.emergencyLocked;
  return (
    <Screen>
      <Card>
        <Text variant="heading">{locked ? 'Bloqueo de emergencia ACTIVO' : 'Bloqueo de emergencia'}</Text>
        <Text tone="muted" variant="bodySmall">Bloquea al instante todas tus tarjetas y las operaciones salientes. Usalo si perdiste el celular o sospechás fraude.</Text>
        {feedback}
        {locked ? (
          <Stack gap="md">
            <Input label="Contraseña para desbloquear" value={pwd} onChangeText={setPwd} secureTextEntry />
            <Button title="Desbloquear" onPress={async () => { if (await exec(cmd.setEmergencyLock(false, pwd), 'Cuenta desbloqueada.')) setPwd(''); }} />
          </Stack>
        ) : <ConfirmButton title="Bloquear todo ahora" variant="danger" icon="lock-closed" onConfirm={() => exec(cmd.setEmergencyLock(true), 'Bloqueo activado.')} />}
      </Card>
    </Screen>
  );
}

export const securityFeatures: Feature[] = [
  { id: 'login', module: 'seguridad', title: 'Inicio de sesión seguro', description: 'Usuario y contraseña con registro de intentos', icon: 'log-in-outline', Component: SessionInfo },
  { id: 'biometric', module: 'seguridad', title: 'Ingreso biométrico', description: 'Huella o Face ID', icon: 'finger-print', Component: Biometric },
  { id: 'quick-pin', module: 'seguridad', title: 'PIN de acceso rápido', description: 'Ingresá con un PIN numérico', icon: 'keypad-outline', Component: QuickPin },
  { id: 'change-password', module: 'seguridad', title: 'Cambiar contraseña', description: 'Con medidor de fortaleza', icon: 'key-outline', Component: ChangePassword },
  { id: 'two-factor', module: 'seguridad', title: 'Autenticación en dos pasos', description: 'Activá o desactivá el 2FA', icon: 'shield-half-outline', Component: TwoFactor },
  { id: 'otp-token', module: 'seguridad', title: 'Token digital (OTP)', description: 'Código que cambia cada 30 s', icon: 'timer-outline', Component: OtpToken },
  { id: 'auto-lock', module: 'seguridad', title: 'Cierre automático de sesión', description: 'Tiempo de inactividad', icon: 'hourglass-outline', Component: AutoLock },
  { id: 'devices', module: 'seguridad', title: 'Dispositivos vinculados', description: 'Revisá y desvinculá', icon: 'phone-portrait-outline', Component: Devices },
  { id: 'login-history', module: 'seguridad', title: 'Historial de accesos', description: 'Accesos exitosos y fallidos', icon: 'time-outline', Component: LoginHistory },
  { id: 'security-questions', module: 'seguridad', title: 'Preguntas de seguridad', description: 'Para recuperar tu acceso', icon: 'help-circle-outline', Component: SecurityQuestions },
  { id: 'privacy-mode', module: 'seguridad', title: 'Modo privacidad', description: 'Ocultá tus saldos', icon: 'eye-off-outline', Component: PrivacyMode },
  { id: 'emergency-lock', module: 'seguridad', title: 'Bloqueo de emergencia', description: 'Congelá tarjetas y operaciones', icon: 'warning-outline', Component: EmergencyLock },
];
