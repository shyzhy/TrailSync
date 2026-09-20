import { Stack } from 'expo-router';
import { COLORS } from '../../src/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.paper },
        headerTintColor: COLORS.ink,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.paper },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="create-account" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="check-email" options={{ title: 'Confirm your email' }} />
    </Stack>
  );
}
