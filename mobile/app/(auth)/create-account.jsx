import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Body, Button, Card, Field, Heading, Input, Muted, Screen } from '../../src/components/ui';
import { formErrors, publicPost } from '../../src/lib/api';

/** Self-registration. The account exists at once but can't sign in until the emailed link is used. */
export default function CreateAccount() {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setErrors({});
    setBusy(true);
    try {
      await publicPost('/api/auth/register/', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      router.replace({ pathname: '/(auth)/check-email', params: { email: form.email.trim().toLowerCase() } });
    } catch (error) {
      setErrors(formErrors(error, ['first_name', 'last_name', 'email', 'password', 'confirm_password']));
    } finally {
      setBusy(false);
    }
  };

  const ready = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.password && form.confirm_password;

  return (
    <Screen>
      <Card>
        <Heading>Create your TrailSync account</Heading>
        <Muted className="mb-4 mt-1">Students and alumni of USTP–CDO. You’ll confirm your email before signing in.</Muted>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="First name" error={errors.first_name}>
              <Input value={form.first_name} onChangeText={set('first_name')} placeholder="Juan" error={errors.first_name} />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Last name" error={errors.last_name}>
              <Input value={form.last_name} onChangeText={set('last_name')} placeholder="Dela Cruz" error={errors.last_name} />
            </Field>
          </View>
        </View>

        <Field label="Email" error={errors.email}>
          <Input
            value={form.email}
            onChangeText={set('email')}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />
        </Field>

        <Field label="Password" error={errors.password} hint="At least 8 characters, and not all numbers.">
          <View>
            <Input
              value={form.password}
              onChangeText={set('password')}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.password}
              style={{ paddingRight: 72 }}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} className="absolute right-3 top-0 h-full justify-center">
              <Muted>{showPassword ? 'Hide' : 'Show'}</Muted>
            </Pressable>
          </View>
        </Field>

        <Field label="Confirm password" error={errors.confirm_password}>
          <Input
            value={form.confirm_password}
            onChangeText={set('confirm_password')}
            placeholder="Type it again"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={errors.confirm_password}
          />
        </Field>

        {errors.general ? (
          <View className="mb-3 rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5">
            <Body className="text-danger">{errors.general}</Body>
          </View>
        ) : null}

        <Button onPress={submit} loading={busy} disabled={!ready}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </Card>
    </Screen>
  );
}
