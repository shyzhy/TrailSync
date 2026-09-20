import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Body, Button, Card, EmptyState, Loading, Muted, Screen, Title } from '../../src/components/ui';
import { apiGet, apiSend, toApiError } from '../../src/lib/api';
import { COLORS } from '../../src/theme/tokens';

function when(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Notifications() {
  const [state, setState] = useState({ items: [], loading: true, refreshing: false, error: null });

  const load = useCallback(async (isRefresh) => {
    setState((prev) => ({ ...prev, loading: !isRefresh && prev.items.length === 0, refreshing: Boolean(isRefresh) }));
    try {
      const data = await apiGet('/api/notifications/?page_size=50');
      setState({ items: data?.results || [], loading: false, refreshing: false, error: null });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: toApiError(error) }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const markRead = async (item) => {
    if (item.is_read) return;
    setState((prev) => ({ ...prev, items: prev.items.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)) }));
    try {
      await apiSend(`/api/notifications/${item.id}/read/`, 'POST');
    } catch {
      load(false);
    }
  };

  const markAll = async () => {
    setState((prev) => ({ ...prev, items: prev.items.map((n) => ({ ...n, is_read: true })) }));
    try {
      await apiSend('/api/notifications/mark-all-read/', 'POST');
    } catch {
      load(false);
    }
  };

  const { items, loading, refreshing, error } = state;
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.blue} />}>
      <View className="mb-4 flex-row items-end justify-between">
        <View className="flex-1">
          <Title>Notifications</Title>
          <Muted className="mt-1">{unread ? `${unread} unread` : 'You’re all caught up.'}</Muted>
        </View>
        {unread ? (
          <Pressable onPress={markAll}>
            <Muted>Mark all read</Muted>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="We couldn’t load your notifications">{error.message}</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing yet">We’ll tell you here when a request moves along.</EmptyState>
      ) : (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => markRead(item)}>
            <Card className="mb-2" style={item.is_read ? undefined : { borderColor: COLORS.blue }}>
              <View className="flex-row items-start">
                {!item.is_read ? <View className="mr-2 mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.blue }} /> : null}
                <View className="flex-1">
                  <Body>{item.title}</Body>
                  <Muted className="mt-1">{item.message}</Muted>
                  <Muted className="mt-2 text-[11px]">
                    {item.request_code ? `${item.request_code} · ` : ''}
                    {when(item.created_at)}
                  </Muted>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
