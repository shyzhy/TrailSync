import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Banner, Body, Button, Card, Field, Heading, Input, Muted } from './ui';
import { apiSend, formErrors, toApiError } from '../lib/api';
import { STATUS } from '../lib/requestStatus';

function longDate(value) {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = () => new Date().toISOString().slice(0, 10);

/** The pickup moment: "I'm here" at Window 6, and asking for a new date after a missed one. */
export default function PickupActions({ request, onUpdated, onStale }) {
  const schedule = request.release_schedule || {};
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState({});
  const [date, setDate] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const announce = async () => {
    setBusy('arrived');
    setErrors({});
    try {
      onUpdated(await apiSend(`/api/form-requests/${request.id}/arrived/`, 'POST'));
    } catch (error) {
      const apiError = toApiError(error);
      setErrors({ general: apiError.message });
      if (apiError.kind === 'conflict') onStale?.();
    } finally {
      setBusy(null);
    }
  };

  const sendDate = async () => {
    if (!ISO_DATE.test(date)) {
      setErrors({ requested_reschedule_date: 'Write the date as YYYY-MM-DD.' });
      return;
    }
    setBusy('reschedule');
    setErrors({});
    try {
      const updated = await apiSend(`/api/form-requests/${request.id}/reschedule/`, 'POST', { requested_reschedule_date: date });
      setFormOpen(false);
      setDate('');
      onUpdated(updated);
    } catch (error) {
      const apiError = toApiError(error);
      setErrors(formErrors(apiError, ['requested_reschedule_date']));
      if (apiError.kind === 'conflict') onStale?.();
    } finally {
      setBusy(null);
    }
  };

  const pending = schedule.reschedule_status === 'Pending';
  const rejected = schedule.reschedule_status === 'Rejected';
  const arrived = Boolean(request.arrival_notice_sent_at) && request.request_status === STATUS.READY;

  if (!request.can_announce_arrival && !arrived && !schedule.missed_pickup_notified_at) return null;

  return (
    <View>
      {request.can_announce_arrival ? (
        <Card className="mt-3">
          <Heading>At Window 6 now?</Heading>
          <Muted className="mb-3 mt-1">Tell them you’re here so they can call you.</Muted>
          {errors.general ? <Banner tone="error">{errors.general}</Banner> : null}
          <Button onPress={announce} loading={busy === 'arrived'}>
            I’m Here for Pickup
          </Button>
        </Card>
      ) : null}

      {/* Tapped already: the button is replaced, so it can't be tapped again. */}
      {arrived ? (
        <Card className="mt-3">
          <Heading>Window 6 has been notified</Heading>
          <Muted className="mt-1">Please wait, they’ll call you shortly.</Muted>
        </Card>
      ) : null}

      {schedule.missed_pickup_notified_at ? (
        <Card className="mt-3">
          <Heading>You missed your pickup on {longDate(schedule.release_date)}</Heading>
          <Muted className="mt-1">Your document is still here. Ask for a new date and Window 6 will confirm it.</Muted>

          {pending ? (
            <View className="mt-3">
              <Body>You asked for {longDate(schedule.requested_reschedule_date)}.</Body>
              <Muted className="mt-1">Your new pickup date request has been sent for approval.</Muted>
            </View>
          ) : formOpen ? (
            <View className="mt-3">
              {rejected ? (
                <Muted className="mb-2">{longDate(schedule.requested_reschedule_date)} wasn’t available. Choose another date.</Muted>
              ) : null}
              <Field label="Which day can you come?" error={errors.requested_reschedule_date} hint={`Write it as YYYY-MM-DD, e.g. ${todayISO()}. Pickups are 3:00 to 5:00 PM.`}>
                <Input
                  value={date}
                  onChangeText={setDate}
                  placeholder={todayISO()}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                  error={errors.requested_reschedule_date}
                />
              </Field>
              {errors.general ? <Banner tone="error">{errors.general}</Banner> : null}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button tone="secondary" onPress={() => setFormOpen(false)} disabled={busy === 'reschedule'}>
                    Cancel
                  </Button>
                </View>
                <View className="flex-1">
                  <Button onPress={sendDate} loading={busy === 'reschedule'} disabled={!date}>
                    Send this date
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <View className="mt-3">
              {rejected ? (
                <Muted className="mb-2">{longDate(schedule.requested_reschedule_date)} wasn’t available. Choose another date.</Muted>
              ) : null}
              <Button onPress={() => setFormOpen(true)}>Request a New Pickup Date</Button>
            </View>
          )}
        </Card>
      ) : null}
    </View>
  );
}
