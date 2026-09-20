import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import TicketCard from '../../../src/components/TicketCard';
import { Body, Button, ChipRow, EmptyState, Input, Loading, Muted, Screen } from '../../../src/components/ui';
import { apiGet, toApiError } from '../../../src/lib/api';
import { FILTERS } from '../../../src/lib/requestStatus';
import { COLORS } from '../../../src/theme/tokens';

export default function TrackRequests() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ items: [], loading: true, refreshing: false, error: null });

  const load = useCallback(
    async (isRefresh, { status = filter, query = search } = {}) => {
      setState((prev) => ({ ...prev, loading: !isRefresh && prev.items.length === 0, refreshing: Boolean(isRefresh) }));
      const params = new URLSearchParams({ page_size: '50' });
      if (status && status !== 'all') params.set('status', status);
      if (query.trim()) params.set('search', query.trim());
      try {
        const data = await apiGet(`/api/form-requests/?${params}`);
        setState({ items: data?.results || [], loading: false, refreshing: false, error: null });
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false, refreshing: false, error: toApiError(error) }));
      }
    },
    [filter, search],
  );

  // Coming back from a detail screen should show whatever changed there.
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const { items, loading, refreshing, error } = state;

  return (
    <Screen scroll={false}>
      <Input
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load(false, { query: search })}
        placeholder="Search by code or document"
        returnKeyType="search"
        autoCapitalize="none"
      />
      <ChipRow
        className="-mx-5 mt-3 px-5"
        options={FILTERS}
        value={filter}
        onChange={(value) => {
          setFilter(value);
          load(false, { status: value });
        }}
      />

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          className="mt-3"
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.blue} />}
          renderItem={({ item }) => <TicketCard request={item} onPress={() => router.push(`/(app)/requests/${item.id}`)} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            error ? (
              <EmptyState title="We couldn’t load your requests">{error.message}</EmptyState>
            ) : (
              <EmptyState title={filter === 'all' ? 'No requests yet' : 'Nothing at this stage'}>
                {filter === 'all' ? 'File one and it will appear here.' : 'Try another filter to see your other requests.'}
              </EmptyState>
            )
          }
          ListFooterComponent={
            items.length > 0 ? (
              <View className="mt-2">
                <Muted className="mb-3 text-center">
                  {items.length} request{items.length === 1 ? '' : 's'}
                </Muted>
                <Button tone="secondary" onPress={() => router.push('/(app)/new-request')}>
                  Request another document
                </Button>
              </View>
            ) : (
              <View className="mt-4">
                <Button onPress={() => router.push('/(app)/new-request')}>Request a document</Button>
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}
