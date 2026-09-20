import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { needsOnboarding, useSession } from '../src/lib/useSession';
import { COLORS } from '../src/theme/tokens';

/** The only decision this screen makes: sign in, finish onboarding, or go to the dashboard. */
export default function Index() {
  const { ready, signedIn, user } = useSession();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={COLORS.blue} />
      </View>
    );
  }
  if (!signedIn) return <Redirect href="/(auth)/login" />;
  if (needsOnboarding(user)) return <Redirect href="/(app)/onboarding" />;
  return <Redirect href="/(app)/dashboard" />;
}
