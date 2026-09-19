import { useCallback, useEffect, useState } from 'react';
import { BusyLabel, ErrorState, Modal, Skeleton, SkeletonGroup } from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { academicStatusLine, isAlumnus } from '../../lib/academics.js';
import { errorFromResponse, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';
import { formatDate, formatDateTime, ROLE_TAG, STATE_PILL } from './accountDisplay.js';

function Row({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="ts-review-label">{label}</dt>
      <dd className="ts-review-value break-words">{children || '—'}</dd>
    </div>
  );
}

// Everything about one account, with the actions that fit its state.
export default function AccountDetailsDialog({ accountId, onClose, onChangeStatus, notify }) {
  const [account, setAccount] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [resending, setResending] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setAccount(null);
    try {
      const res = await authFetch(`/api/admin/accounts/${accountId}/`);
      if (!res.ok) throw await errorFromResponse(res);
      setAccount(await res.json());
    } catch (error) {
      setLoadError(toApiError(error));
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const resendSetup = async () => {
    setResending(true);
    try {
      const res = await authFetch(`/api/admin/accounts/${accountId}/resend-setup/`, { method: 'POST' });
      if (!res.ok) {
        const error = await errorFromResponse(res);
        // A failed send is a server-side hiccup worth naming plainly.
        throw res.status === 502 ? Object.assign(error, { message: 'The setup email couldn’t be sent. Please try again in a moment.' }) : error;
      }
      notify((await res.json()).detail);
    } catch (error) {
      notify(toApiError(error).message, 'error');
    } finally {
      setResending(false);
    }
  };

  const staff = account?.staff;
  const student = account?.student;

  return (
    <Modal label="Account details" onClose={onClose}>
      {loadError && (
        <div className="pt-8">
          <ErrorState boxed={false} error={loadError} title="We couldn&rsquo;t load this account" onRetry={load} />
        </div>
      )}

      {!loadError && !account && (
        <SkeletonGroup label="Loading account details" className="space-y-4 pt-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </SkeletonGroup>
      )}

      {account && (
        <>
          <div className="pr-10">
            <h2 className="ts-ink text-2xl font-semibold" style={FONT_SERIF}>
              {account.name || account.email}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={ROLE_TAG[account.role] || 'ts-tag ts-tag-muted'}>{account.role || 'No role'}</span>
              <span className={`ts-pill ${STATE_PILL[account.account_state] || 'ts-pill-released'}`}>{account.account_state}</span>
            </div>
          </div>

          {staff?.awaiting_setup && account.status === 'Active' && (
            <div className="ts-banner ts-banner-pending mt-5 px-4 py-3 text-sm">
              <p className="font-semibold">Waiting for them to set up the account.</p>
              <p className="mt-1">They can&rsquo;t log in until they choose a password from the setup email.</p>
              <button type="button" onClick={resendSetup} disabled={resending} className="ts-link mt-2 font-semibold">
                <BusyLabel busy={resending} busyLabel="Sending…">
                  Resend setup email
                </BusyLabel>
              </button>
            </div>
          )}

          <h3 className="ts-ink mt-6 text-sm font-semibold">Account</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Row label="Email">{account.email}</Row>
            <Row label="Contact number">{account.contact_number}</Row>
            <Row label="Joined">{formatDate(account.date_joined)}</Row>
            <Row label="Last login">{formatDateTime(account.last_login)}</Row>
            {!staff && <Row label="Email confirmed">{account.email_verified ? 'Yes' : 'Not yet'}</Row>}
          </dl>

          {student && (
            <>
              <h3 className="ts-ink mt-6 text-sm font-semibold">Student profile</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Row label="School ID number">{student.school_id_number}</Row>
                <Row label="Course">{student.course}</Row>
                <Row label="Academic status" className="sm:col-span-2">
                  {academicStatusLine(student.academic_status)}
                </Row>
                <Row label="Last semester attended">{student.last_semester_attended}</Row>
                {isAlumnus(student.academic_status) && <Row label="Graduated">{formatDate(student.graduation_date)}</Row>}
                <Row label="Requests">
                  {student.request_count}
                  {student.last_request_at ? ` · latest ${formatDate(student.last_request_at)}` : ''}
                </Row>
              </dl>
            </>
          )}

          {staff && (
            <>
              <h3 className="ts-ink mt-6 text-sm font-semibold">Staff profile</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Row label="Employee ID">{staff.employee_id}</Row>
                <Row label="Assigned window">{staff.assigned_window ? `Window ${staff.assigned_window}` : null}</Row>
                <Row label="Approval">{staff.approval_status}</Row>
                <Row label="Approved by">
                  {staff.approved_by ? `${staff.approved_by}, ${formatDate(staff.approved_at)}` : formatDate(staff.approved_at)}
                </Row>
              </dl>
            </>
          )}

          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
              Close
            </button>
            {account.can_change_status && (
              <button
                type="button"
                onClick={() => onChangeStatus(account)}
                className={`${account.status === 'Active' ? 'ts-btn-outline-danger' : 'ts-btn-primary'} px-6 py-2.5 text-sm font-medium`}
              >
                {account.status === 'Active' ? 'Suspend account' : 'Reactivate account'}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
