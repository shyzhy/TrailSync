import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Body, Button, Card, EmptyState, Heading, Loading, Muted, Pill, Screen, Title } from '../../src/components/ui';
import { apiGet } from '../../src/lib/api';
import { STUDENT_STATUS_LABEL } from '../../src/lib/requestStatus';
import { useSession } from '../../src/lib/useSession';
import { COLORS, FONTS } from '../../src/theme/tokens';

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ value, label, tone }) {
  return (
    <Card className="flex-1 py-3">
      <Body className="text-[26px]" style={{ fontFamily: FONTS.serif, color: tone || COLORS.ink, lineHeight: 32 }}>
        {value ?? '—'}
      </Body>
      <Muted className="mt-1">{label}</Muted>
    </Card>
  );
}

function QuickAction({ icon, title, hint, onPress }) {
  return (
    <Pressable onPress={onPress} className="mb-2 flex-row items-center rounded-xl border border-hairline bg-surface px-3.5 py-3">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.blueSoft }}>
        <Ionicons name={icon} size={18} color={COLORS.blue} />
      </View>
      <View className="flex-1">
        <Body>{title}</Body>
        <Muted className="mt-0.5">{hint}</Muted>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.inkFaint} />
    </Pressable>
  );
}

export default function Dashboard() {
  const { user } = useSession();
  const [state, setState] = useState({ loading: true, refreshing: false, summary: null, recent: [], dates: [] });

  const load = useCallback(async (isRefresh) => {
    setState((prev) => ({ ...prev, loading: !isRefresh && !prev.summary, refreshing: Boolean(isRefresh) }));
    try {
      const [summary, recent, upcoming] = await Promise.all([
        apiGet('/api/dashboard/summary/'),
        apiGet('/api/dashboard/recent-requests/'),
        apiGet('/api/dashboard/upcoming-release-dates/'),
      ]);
      setState({
        loading: false,
        refreshing: false,
        summary,
        recent: recent?.results || recent || [],
        dates: upcoming?.dates || [],
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false, refreshing: false }));
    }
  }, []);

  // Re-read on every visit: a request filed on another screen should show up here without a manual pull.
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const { loading, refreshing, summary, recent, dates } = state;
  const firstName = user?.first_name || 'there';

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.blue} />}>
      <View className="mb-1 flex-row items-start justify-between">
        <View className="flex-1">
          <Muted>{greeting()},</Muted>
          <Title className="mt-0.5">{firstName}</Title>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          accessibilityLabel="Notifications"
          className="h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface"
        >
          <Ionicons name="notifications-outline" size={18} color={COLORS.ink} />
        </Pressable>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <>
          <View className="mb-4 mt-3 flex-row gap-3">
            <Stat value={summary?.active_requests_count} label="Active requests" />
            <Stat value={summary?.ready_for_pickup_count} label="Ready for pickup" tone={COLORS.sage} />
            <Stat value={summary?.released_this_year_count} label="Released this year" />
          </View>

          <Heading className="mb-2">What would you like to do?</Heading>
          <QuickAction
            icon="add-circle"
            title="Request a document"
            hint="Transcript, certification, Form 137 and more"
            onPress={() => router.push('/(app)/new-request')}
          />
          <QuickAction
            icon="documents"
            title="Track your requests"
            hint="See where each one is, and print your form"
            onPress={() => router.push('/(app)/requests')}
          />
          <QuickAction
            icon="book"
            title="Credential guide"
            hint="What each document is, and what it costs"
            onPress={() => router.push('/(app)/guide')}
          />

          {dates.length > 0 ? (
            <Card className="mt-4">
              <Heading>Upcoming pickups</Heading>
              <Muted className="mt-1">Window 6 releases documents from 3:00 to 5:00 PM.</Muted>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {dates.slice(0, 4).map((date) => (
                  <View key={date} className="rounded-xl border border-sage px-3 py-2" style={{ backgroundColor: COLORS.sageSoft }}>
                    <Body className="text-[13px]">{shortDate(date)}</Body>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Heading className="mb-2 mt-5">Recent requests</Heading>
          {recent.length === 0 ? (
            <EmptyState title="Nothing here yet">
              Your requests will appear here once you file one.
            </EmptyState>
          ) : (
            recent.slice(0, 5).map((item) => (
              <Pressable
                key={item.request_code}
                onPress={() => router.push('/(app)/requests')}
                className="mb-2 flex-row items-center rounded-xl border border-hairline bg-surface px-3.5 py-3"
              >
                <View className="flex-1">
                  <Body numberOfLines={1}>{item.transaction_type}</Body>
                  <Muted className="mt-0.5">
                    {item.request_code} · {shortDate(item.created_at)}
                  </Muted>
                </View>
                <Pill status={item.request_status} label={STUDENT_STATUS_LABEL[item.request_status] || item.request_status} />
              </Pressable>
            ))
          )}

          <View className="mt-5">
            <Button onPress={() => router.push('/(app)/new-request')}>Request a document</Button>
          </View>
        </>
      )}
    </Screen>
  );
}
