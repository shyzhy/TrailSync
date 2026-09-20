import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';

import { Body, Button, Card, EmptyState, Heading, Loading, Muted, Screen, Title } from '../../src/components/ui';
import { useApi } from '../../src/lib/useApi';
import { COLORS } from '../../src/theme/tokens';

function fee(type) {
  if (type.fee_amount === null || type.fee_amount === undefined || type.fee_amount === '') return 'No set fee';
  const n = Number(type.fee_amount);
  if (Number.isNaN(n)) return 'No set fee';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${type.pricing_unit === 'per_page' ? 'per page' : 'per copy'}`;
}

/** What each document is, what it costs and how long it takes: the catalogue, read from the same API the web app uses. */
export default function CredentialGuide() {
  const { data, loading, refreshing, refresh, error } = useApi('/api/transaction-types/');
  const [openId, setOpenId] = useState(null);
  const types = data?.results || data || [];

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.blue} />}>
      <Title>Credential guide</Title>
      <Muted className="mb-4 mt-1">Every document Window 6 issues, what it costs, and what to bring.</Muted>

      {loading ? (
        <Loading />
      ) : error ? (
        <EmptyState title="We couldn’t load the guide">{error.message}</EmptyState>
      ) : (
        types.map((type) => {
          const open = openId === type.id;
          return (
            <Card key={type.id} className="mb-3">
              <Pressable onPress={() => setOpenId(open ? null : type.id)}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Heading>{type.name}</Heading>
                    <Muted className="mt-1">
                      {fee(type)}
                      {type.processing_time ? ` · ${type.processing_time}` : ''}
                    </Muted>
                  </View>
                  <Muted>{open ? 'Hide' : 'Details'}</Muted>
                </View>
              </Pressable>

              {open ? (
                <View className="mt-3">
                  {type.description ? <Body className="mb-3">{type.description}</Body> : null}
                  {type.required_documents ? (
                    <>
                      <Muted className="mb-1">You’ll need</Muted>
                      <Body className="mb-3">{type.required_documents}</Body>
                    </>
                  ) : null}
                  {type.special_notes ? (
                    <>
                      <Muted className="mb-1">Worth knowing</Muted>
                      <Body className="mb-3">{type.special_notes}</Body>
                    </>
                  ) : null}
                  {type.is_available === false ? (
                    <Muted>This document is paused at the moment, so it can’t be requested.</Muted>
                  ) : (
                    <Button onPress={() => router.push('/(app)/new-request')}>Request this</Button>
                  )}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
