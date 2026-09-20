import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { Body, Button, Card, Field, Heading, Input, Muted, Screen } from '../../src/components/ui';
import { formErrors, publicPost } from '../../src/lib/api';

/** Asks for the reset email. The link itself opens the website, where the new password is set. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErrors({});
    setBusy(true);
    try {
      await publicPost('/api/auth/password-reset/request/', { email: email.trim().toLowerCase(), audience: 'student' });
      setSent(true);
    } catch (error) {
      setErrors(formErrors(error, ['email']));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <Card>
          <Heading>Check your email</Heading>
          <Muted className="mt-1">
            If an account uses {email.trim().toLowerCase()}, a reset link is on its way. The link opens TrailSync on the web, where you can
            set a new password.
          </Muted>
          <View className="mt-5">
            <Button onPress={() => router.replace('/(auth)/login')}>Back to sign in</Button>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Heading>Reset your password</Heading>
        <Muted className="mb-4 mt-1">Tell us the email on your account and we’ll send a reset link.</Muted>
        <Field label="Email" error={errors.email}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
            onSubmitEditing={submit}
          />
        </Field>
        {errors.general ? (
          <View className="mb-3 rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5">
            <Body className="text-danger">{errors.general}</Body>
          </View>
        ) : null}
        <Button onPress={submit} loading={busy} disabled={!email.trim()}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </Card>
    </Screen>
  );
}
