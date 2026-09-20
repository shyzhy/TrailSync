import { Pressable, View } from 'react-native';

import { Body, Card, Muted, Pill } from './ui';
import { LIFECYCLE, NEXT_STEP, STATUS, STUDENT_STATUS_LABEL } from '../lib/requestStatus';
import { COLORS, FONTS } from '../theme/tokens';

export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The lifecycle as dots and rules; an exited request (rejected, cancelled) doesn't get one. */
function Progress({ status }) {
  const current = LIFECYCLE.indexOf(status);
  return (
    <View className="mt-3 flex-row items-center">
      {LIFECYCLE.map((step, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <View key={step} className={i < LIFECYCLE.length - 1 ? 'flex-1 flex-row items-center' : 'flex-row items-center'}>
            <View
              className="rounded-full"
              style={{
                width: here ? 10 : 8,
                height: here ? 10 : 8,
                backgroundColor: done ? COLORS.sage : here ? COLORS.blue : COLORS.hairline,
              }}
            />
            {i < LIFECYCLE.length - 1 ? (
              <View className="mx-1 h-[2px] flex-1" style={{ backgroundColor: done ? COLORS.sage : COLORS.hairline }} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** One request, as the ticket stub the web app shows: code on the tear-off, the rest on the body. */
export default function TicketCard({ request, onPress }) {
  const exited = request.request_status === STATUS.REJECTED || request.request_status === STATUS.CANCELLED;
  return (
    <Pressable onPress={onPress} className="mb-3">
      <Card className="flex-row overflow-hidden p-0">
        <View className="w-[84px] items-center justify-center px-2 py-4" style={{ backgroundColor: COLORS.blue }}>
          <Body className="text-center text-[13px]" style={{ color: '#FFFFFF', fontFamily: FONTS.serif }}>
            {request.request_code}
          </Body>
          <Muted className="mt-1 text-center text-[10px]" style={{ color: '#C9D4E6' }}>
            WINDOW 6
          </Muted>
        </View>

        <View className="flex-1 px-3.5 py-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Body numberOfLines={1}>{request.transaction_type}</Body>
              <Muted className="mt-0.5">
                {request.number_of_copies ? `${request.number_of_copies} ${request.number_of_copies === 1 ? 'copy' : 'copies'} · ` : ''}
                {shortDate(request.created_at)}
              </Muted>
            </View>
            <Pill status={request.request_status} label={STUDENT_STATUS_LABEL[request.request_status]} />
          </View>

          {exited ? (
            <Muted className="mt-2">
              {request.request_status === STATUS.CANCELLED
                ? `Cancelled${request.cancelled_at ? ` on ${shortDate(request.cancelled_at)}` : ''}.`
                : request.verification_remarks || 'This request wasn’t approved.'}
            </Muted>
          ) : (
            <>
              <Progress status={request.request_status} />
              <Muted className="mt-2">{NEXT_STEP[request.request_status]}</Muted>
            </>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
