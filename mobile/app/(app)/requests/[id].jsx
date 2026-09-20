import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import PaymentProofPanel from '../../../src/components/PaymentProofPanel';
import { shortDate } from '../../../src/components/TicketCard';
import { Banner, Body, Button, Card, Field, Heading, Input, Label, Loading, Muted, OptionRow, Pill, Screen, Title } from '../../../src/components/ui';
import { API_BASE_URL } from '../../../src/lib/config';
import { apiGet, apiSend, formErrors, toApiError } from '../../../src/lib/api';
import { getAccessToken } from '../../../src/lib/session';
import { PROXY_RELATIONSHIPS } from '../../../src/lib/academics';
import { LIFECYCLE, NEXT_STEP, STATUS, STUDENT_STATUS_LABEL } from '../../../src/lib/requestStatus';
import { COLORS } from '../../../src/theme/tokens';

function money(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <View className="mb-3 w-1/2 pr-3">
      <Label>{label}</Label>
      <Body>{children}</Body>
    </View>
  );
}

export default function RequestDetail() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [proxy, setProxy] = useState({ open: false, proxy_full_name: '', relationship: '', contact_number: '', errors: {} });

  const load = useCallback(async () => {
    try {
      // The student API has no per-request endpoint, so the row comes from their own list.
      const data = await apiGet('/api/form-requests/?page_size=100');
      const found = (data?.results || []).find((item) => String(item.id) === String(id));
      if (!found) throw new Error('missing');
      setRequest(found);
      navigation.setOptions({ title: found.request_code });
    } catch (err) {
      setError(toApiError(err));
    }
  }, [id, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (kind, filename) => {
    setBusy(kind);
    setNotice('');
    try {
      const destination = new File(Paths.cache, filename);
      if (destination.exists) destination.delete();
      const task = File.createDownloadTask(`${API_BASE_URL}/api/form-requests/${request.id}/${kind}/`, destination, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const file = await task.downloadAsync();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
      } else {
        setNotice(`Saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert('That document didn’t download', toApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel this request?', 'This can’t be undone. You can always file a new one.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setBusy('cancel');
          try {
            setRequest(await apiSend(`/api/form-requests/${request.id}/cancel/`, 'POST'));
            setNotice('Your request has been cancelled.');
          } catch (err) {
            Alert.alert('It wasn’t cancelled', toApiError(err).message);
            load();
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const saveProxy = async () => {
    setBusy('proxy');
    try {
      const updated = await apiSend(`/api/form-requests/${request.id}/proxy/`, 'PUT', {
        proxy_full_name: proxy.proxy_full_name.trim(),
        relationship: proxy.relationship,
        contact_number: proxy.contact_number.trim(),
      });
      setRequest(updated);
      setProxy({ open: false, proxy_full_name: '', relationship: '', contact_number: '', errors: {} });
      setNotice('Saved. Window 6 has been told who is collecting.');
    } catch (err) {
      setProxy((prev) => ({ ...prev, errors: formErrors(err, ['proxy_full_name', 'relationship', 'contact_number']) }));
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <Screen>
        <Banner tone="error" title="We couldn’t open this request">
          {error.message}
        </Banner>
        <Button onPress={load}>Try again</Button>
      </Screen>
    );
  }
  if (!request) return <Screen><Loading /></Screen>;

  const amount = money(request.amount_due);
  const locked = Boolean(request.amount_locked);
  const exited = request.request_status === STATUS.REJECTED || request.request_status === STATUS.CANCELLED;
  const schedule = request.release_schedule;

  return (
    <Screen>
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Title>{request.transaction_type}</Title>
            <Muted className="mt-1">
              {request.request_code} · filed {shortDate(request.created_at)}
            </Muted>
          </View>
          <Pill status={request.request_status} label={STUDENT_STATUS_LABEL[request.request_status]} />
        </View>

        {!exited ? (
          <>
            <View className="mt-4 flex-row items-center">
              {LIFECYCLE.map((step, i) => {
                const current = LIFECYCLE.indexOf(request.request_status);
                const done = i < current;
                const here = i === current;
                return (
                  <View key={step} className={i < LIFECYCLE.length - 1 ? 'flex-1 flex-row items-center' : 'flex-row items-center'}>
                    <View
                      className="rounded-full"
                      style={{ width: here ? 11 : 9, height: here ? 11 : 9, backgroundColor: done ? COLORS.sage : here ? COLORS.blue : COLORS.hairline }}
                    />
                    {i < LIFECYCLE.length - 1 ? (
                      <View className="mx-1 h-[2px] flex-1" style={{ backgroundColor: done ? COLORS.sage : COLORS.hairline }} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <Muted className="mt-2">{NEXT_STEP[request.request_status]}</Muted>
          </>
        ) : null}
      </Card>

      {request.request_status === STATUS.READY ? (
        <View className="mt-3">
          <Banner tone="success" title="Ready to pick up">
            {schedule?.release_date
              ? `${shortDate(schedule.release_date)} at Window 6. Bring your claim stub and a valid ID.`
              : 'Window 6 releases documents from 3:00 to 5:00 PM. Bring your claim stub and a valid ID.'}
          </Banner>
        </View>
      ) : null}
      {request.request_status === STATUS.REJECTED && request.verification_remarks ? (
        <View className="mt-3">
          <Banner tone="error" title="This request wasn’t approved">
            {request.verification_remarks}
          </Banner>
        </View>
      ) : null}
      {request.requires_archive_retrieval && !exited ? (
        <View className="mt-3">
          <Banner tone="warning">Your records are in the university archive, so this may take a little longer than usual.</Banner>
        </View>
      ) : null}

      <Card className="mt-3">
        <Heading className="mb-3">Details</Heading>
        <View className="flex-row flex-wrap">
          <Row label="What it’s for">{request.purpose === 'Others' ? request.purpose_other || 'Others' : request.purpose}</Row>
          <Row label="Copies">{request.number_of_copies}</Row>
          <Row label="Last semester">{request.semester}</Row>
          {request.page_count ? <Row label="Pages">{`${request.page_count} per copy`}</Row> : null}
          {amount ? <Row label={locked ? 'Amount paid' : 'Amount to pay'}>{amount}</Row> : null}
          {request.payment_date ? <Row label="Date paid">{shortDate(request.payment_date)}</Row> : null}
          {request.graduation_date ? <Row label="Graduated">{shortDate(request.graduation_date)}</Row> : null}
        </View>
        {amount ? <Muted>{locked ? 'Paid at the Cashier.' : 'At the current fee, paid at the Cashier.'}</Muted> : null}
        {request.additional_notes ? (
          <View className="mt-2">
            <Label>Your notes</Label>
            <Body>{request.additional_notes}</Body>
          </View>
        ) : null}
      </Card>

      {request.receipt_available ? (
        <Card className="mt-3">
          <Heading>Your form</Heading>
          <Muted className="mb-3 mt-1">
            {locked
              ? 'Your request form as it stood when your payment was logged, for your records.'
              : 'Print this form, pay at the Cashier, then present it at Window 6.'}
          </Muted>
          <Button
            tone={locked ? 'secondary' : 'primary'}
            loading={busy === 'receipt'}
            onPress={() => download('receipt', `TrailSync-${request.request_code}.pdf`)}
          >
            Download form
          </Button>
        </Card>
      ) : null}

      <PaymentProofPanel request={request} onUpdated={(updated) => { setRequest(updated); setNotice('Submitted — we’ll review your payment and notify you once it’s confirmed.'); }} />

      {request.digital_stub_active ? (
        <Card className="mt-3">
          <Heading>Claim stub</Heading>
          <Muted className="mb-3 mt-1">Your payment is logged. Bring this stub and a valid ID to Window 6.</Muted>
          <Button loading={busy === 'claim-stub'} onPress={() => download('claim-stub', `TrailSync-ClaimStub-${request.request_code}.pdf`)}>
            Download claim stub
          </Button>
        </Card>
      ) : null}

      {request.proxy ? (
        <Card className="mt-3">
          <Heading>Someone else is collecting</Heading>
          <Muted className="mt-1">
            {request.proxy.proxy_full_name} ({request.proxy.relationship}) · {request.proxy.contact_number}
          </Muted>
          <Muted className="mt-2">They must bring a notarised authorisation letter and both your valid IDs.</Muted>
        </Card>
      ) : null}

      {request.can_change_proxy ? (
        <Card className="mt-3">
          {proxy.open ? (
            <>
              <Heading className="mb-3">{request.proxy ? 'Change who collects it' : 'Name someone to collect it'}</Heading>
              <Field label="Full name" error={proxy.errors.proxy_full_name}>
                <Input
                  value={proxy.proxy_full_name}
                  onChangeText={(v) => setProxy((p) => ({ ...p, proxy_full_name: v }))}
                  placeholder="Their full name"
                  error={proxy.errors.proxy_full_name}
                />
              </Field>
              <Field label="Relationship" error={proxy.errors.relationship}>
                {PROXY_RELATIONSHIPS.map((option) => (
                  <OptionRow
                    key={option}
                    title={option}
                    selected={proxy.relationship === option}
                    onPress={() => setProxy((p) => ({ ...p, relationship: option }))}
                  />
                ))}
              </Field>
              <Field label="Contact number" error={proxy.errors.contact_number}>
                <Input
                  value={proxy.contact_number}
                  onChangeText={(v) => setProxy((p) => ({ ...p, contact_number: v }))}
                  placeholder="09XX XXX XXXX"
                  keyboardType="phone-pad"
                  error={proxy.errors.contact_number}
                />
              </Field>
              {proxy.errors.general ? <Banner tone="error">{proxy.errors.general}</Banner> : null}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button tone="secondary" onPress={() => setProxy({ open: false, proxy_full_name: '', relationship: '', contact_number: '', errors: {} })}>
                    Cancel
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    loading={busy === 'proxy'}
                    disabled={!proxy.proxy_full_name.trim() || !proxy.relationship || !proxy.contact_number.trim()}
                    onPress={saveProxy}
                  >
                    Save
                  </Button>
                </View>
              </View>
            </>
          ) : (
            <>
              <Heading>{request.proxy ? 'Plans changed?' : 'Can’t collect it yourself?'}</Heading>
              <Muted className="mb-3 mt-1">
                {request.proxy ? 'Name someone else to collect it instead.' : 'Name someone to collect it on your behalf.'}
              </Muted>
              <Button tone="secondary" onPress={() => setProxy((p) => ({ ...p, open: true }))}>
                {request.proxy ? 'Change proxy' : 'Assign a proxy'}
              </Button>
            </>
          )}
        </Card>
      ) : null}

      {request.can_cancel ? (
        <View className="mt-5">
          <Button tone="danger" loading={busy === 'cancel'} onPress={cancel}>
            Cancel this request
          </Button>
          <Muted className="mt-2 text-center">You can cancel until your payment is logged.</Muted>
        </View>
      ) : null}
    </Screen>
  );
}
