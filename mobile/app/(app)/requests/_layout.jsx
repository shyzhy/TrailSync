import { Stack } from 'expo-router';
import { COLORS } from '../../../src/theme/tokens';

export default function RequestsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Track requests' }} />
      <Stack.Screen name="[id]" options={{ title: 'Request' }} />
    </Stack>
  );
}
