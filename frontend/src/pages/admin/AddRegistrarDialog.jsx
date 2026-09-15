import { useState } from 'react';
import { BusyLabel, FieldError, Modal, SuccessSeal } from '../../components/ui/index.js';
import { FONT_SERIF } from '../../styles/fonts.js';
import { errorFromResponse, formErrors, toApiError } from '../../lib/api.js';
import { authFetch } from '../../lib/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY = { email: '', firstName: '', middleName: '', lastName: '', employeeId: '', assignedWindow: '6' };
const SERVER_FIELDS = {
  email: 'email',
  first_name: 'firstName',
  middle_name: 'middleName',
  last_name: 'lastName',
  employee_id: 'employeeId',
  assigned_window: 'assignedWindow',
};

function TextField({ id, label, optional, value, onChange, error, type = 'text', placeholder, prefix, autoFocus }) {
  return (
    <div>
      <label htmlFor={id} className="ts-ink mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="ts-soft font-normal">(optional)</span>}
      </label>
      <div className="relative">
        {prefix && (
          <span className="ts-soft pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm">{prefix}</span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`ts-input w-full py-2.5 pr-3.5 text-sm ${prefix ? 'pl-[4.5rem]' : 'pl-3.5'} ${error ? 'ts-input-error' : ''}`}
        />
      </div>
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// Create a pre-approved staff account; the new staff member chooses their own password from the setup email.
export default function AddRegistrarDialog({ onClose, onCreated }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => (prev[key] || prev.general ? { ...prev, [key]: undefined, general: undefined } : prev));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = {};
    if (!values.email.trim()) found.email = 'Please enter their email address.';
    else if (!EMAIL_RE.test(values.email.trim())) found.email = 'Please enter a valid email address.';
    if (!values.firstName.trim()) found.firstName = 'Please enter their first name.';
    if (!values.lastName.trim()) found.lastName = 'Please enter their last name.';
    if (!values.employeeId.trim()) found.employeeId = 'Please enter their employee ID.';
    if (!values.assignedWindow.trim()) found.assignedWindow = 'Please enter the window they work at.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const res = await authFetch('/api/admin/accounts/registrar/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: values.email.trim(),
          first_name: values.firstName.trim(),
          middle_name: values.middleName.trim(),
          last_name: values.lastName.trim(),
          employee_id: values.employeeId.trim(),
          assigned_window: values.assignedWindow.trim(),
        }),
      });
      if (!res.ok) throw await errorFromResponse(res);
      const data = await res.json();
      setResult(data);
      onCreated(data.account);
    } catch (error) {
      setErrors(formErrors(toApiError(error), SERVER_FIELDS));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Modal label="Registrar account created" onClose={onClose}>
        <div className="flex flex-col items-center pt-4 text-center">
          <SuccessSeal />
          <h2 className="ts-ink mt-5 text-2xl font-semibold" style={FONT_SERIF}>
            {result.email_sent ? 'Account created' : 'Account created, email not sent'}
          </h2>
          <p role="status" className="ts-soft mt-2 max-w-sm text-base leading-relaxed">
            {result.detail}
          </p>
          {result.email_sent && (
            <p className="ts-soft mt-3 max-w-sm text-sm leading-relaxed">
              Until they choose a password, the account shows as <strong className="ts-ink">Awaiting Setup</strong>. The
              link works for 3 days.
            </p>
          )}
          <div className="mt-7 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setValues(EMPTY);
              }}
              className="ts-btn-glass px-6 py-2.5 text-sm font-medium"
            >
              Add another
            </button>
            <button type="button" onClick={onClose} className="ts-btn-primary px-6 py-2.5 text-sm font-medium">
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal label="Add Registrar Account" onClose={onClose}>
      <h2 className="ts-ink pr-10 text-2xl font-semibold" style={FONT_SERIF}>
        Add Registrar Account
      </h2>
      <p className="ts-soft mt-1.5 text-sm leading-relaxed">
        The account is approved straight away. We&rsquo;ll email them a link to choose their own password, so you never
        set or see it.
      </p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <TextField
          id="staffEmail"
          label="Email"
          type="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          placeholder="e.g. maria.santos@ustp.edu.ph"
          autoFocus
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="staffFirstName" label="First name" value={values.firstName} onChange={set('firstName')} error={errors.firstName} />
          <TextField id="staffLastName" label="Last name" value={values.lastName} onChange={set('lastName')} error={errors.lastName} />
        </div>
        <TextField
          id="staffMiddleName"
          label="Middle name"
          optional
          value={values.middleName}
          onChange={set('middleName')}
          error={errors.middleName}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="staffEmployeeId"
            label="Employee ID"
            value={values.employeeId}
            onChange={set('employeeId')}
            error={errors.employeeId}
            placeholder="e.g. EMP-0042"
          />
          <TextField
            id="staffWindow"
            label="Assigned window"
            value={values.assignedWindow}
            onChange={set('assignedWindow')}
            error={errors.assignedWindow}
            prefix="Window"
            placeholder="6"
          />
        </div>

        {errors.general && (
          <div role="alert" className="ts-banner ts-banner-error px-3.5 py-2.5 text-sm">
            {errors.general}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="ts-btn-glass px-6 py-2.5 text-sm font-medium">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="ts-btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium"
          >
            <BusyLabel busy={saving} busyLabel="Creating…">
              Create account and send email
            </BusyLabel>
          </button>
        </div>
      </form>
    </Modal>
  );
}
