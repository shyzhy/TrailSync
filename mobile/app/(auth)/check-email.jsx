import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Body, Button, Card, Heading, Muted, Screen } from '../../src/components/ui';
import { publicPost, toApiError } from '../../src/lib/api';

/**
 * After registering, or after signing in with an unconfirmed address. Confirming happens in the emailed link, which
 * opens the website; this screen exists so the app says what to do and can send the email again.
 */
export default function CheckEmail() {
  const { email = '' } = useLocalSearchParams();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setNotice('');
    setError('');
    setBusy(true);
    try {
      await publicPost('/api/auth/resend-activation/', { email: String(email) });
      setNotice('Sent. Check your inbox, and your spam folder just in case.');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Heading>Confirm your email</Heading>
        <Muted className="mt-1">
          We sent a confirmation link to {email ? <Body className="text-ink">{String(email)}</Body> : 'your email address'}. Open it to
          activate your account, then come back here and sign in.
        </Muted>

        {notice ? (
          <View className="mt-4 rounded-xl border border-sage bg-sage-soft px-3.5 py-2.5">
            <Body>{notice}</Body>
          </View>
        ) : null}
        {error ? (
          <View className="mt-4 rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5">
            <Body className="text-danger">{error}</Body>
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          <Button onPress={resend} loading={busy} tone="secondary" disabled={!email}>
            Send the link again
          </Button>
          <Button onPress={() => router.replace('/(auth)/login')}>Back to sign in</Button>
        </View>
      </Card>
    </Screen>
  );
}
