import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Link, router } from 'expo-router';

import { Body, Button, Card, Field, Heading, Input, Muted, Screen, Title } from '../../src/components/ui';
import { formErrors } from '../../src/lib/api';
import { needsOnboarding, useSession } from '../../src/lib/useSession';

/** Students only, matching the web app's split logins: staff and admins sign in on the website. */
export default function Login() {
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErrors({});
    setBusy(true);
    try {
      const user = await signIn(identifier, password);
      router.replace(needsOnboarding(user) ? '/(app)/onboarding' : '/(app)/dashboard');
    } catch (error) {
      setErrors(formErrors(error, ['identifier', 'password']));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="items-center pb-6 pt-10">
          <Image source={require('../../assets/trailsync-logo.png')} style={{ width: 64, height: 64 }} resizeMode="contain" />
          <Title className="mt-3">TrailSync</Title>
          <Muted className="mt-1 text-center">
            USTP–CDO Office of the Registrar · Window 6
          </Muted>
        </View>

        <Card>
          <Heading>Sign in</Heading>
          <Muted className="mb-4 mt-1">Use your student email or school ID number.</Muted>

          <Field label="Email or school ID" error={errors.identifier}>
            <Input
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="email-address"
              error={errors.identifier}
              returnKeyType="next"
            />
          </Field>

          <Field label="Password" error={errors.password}>
            <View>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                error={errors.password}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={{ paddingRight: 72 }}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} className="absolute right-3 top-0 h-full justify-center">
                <Muted>{showPassword ? 'Hide' : 'Show'}</Muted>
              </Pressable>
            </View>
          </Field>

          {errors.general ? (
            <View className="mb-3 rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5">
              <Body className="text-danger">{errors.general}</Body>
            </View>
          ) : null}

          <Button onPress={submit} loading={busy} disabled={!identifier.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable className="mt-4 items-center">
              <Muted>Forgot your password?</Muted>
            </Pressable>
          </Link>
        </Card>

        <View className="mt-5 flex-row items-center justify-center">
          <Muted>New to TrailSync? </Muted>
          <Link href="/(auth)/create-account" asChild>
            <Pressable>
              <Body className="text-blue">Create an account</Body>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
