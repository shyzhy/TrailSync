import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSession } from '../../src/lib/useSession';
import { COLORS } from '../../src/theme/tokens';

const ICONS = {
  dashboard: 'home',
  requests: 'documents',
  guide: 'book',
  profile: 'person',
};

/** The signed-in shell: four tabs, with the rest of the screens pushed on top of them. */
export default function AppLayout() {
  const { ready, signedIn } = useSession();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={COLORS.blue} />
      </View>
    );
  }
  // A failed token refresh clears the session, and every screen inside here falls back to the login.
  if (!signedIn) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.paper },
        headerTintColor: COLORS.ink,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: COLORS.paper },
        tabBarActiveTintColor: COLORS.blue,
        tabBarInactiveTintColor: COLORS.inkFaint,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.hairline },
        tabBarIcon: ({ color, size, focused }) => {
          const name = ICONS[route.name] || 'ellipse';
          return <Ionicons name={focused ? name : `${name}-outline`} size={size - 2} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', headerShown: false }} />
      <Tabs.Screen name="guide" options={{ title: 'Guide' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/* Reached from the screens themselves, not from the tab bar. */}
      <Tabs.Screen name="new-request" options={{ href: null, title: 'New request' }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
      <Tabs.Screen name="onboarding" options={{ href: null, title: 'Finish your profile' }} />
    </Tabs>
  );
}
