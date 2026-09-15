import PasswordLinkPage, { BrokenLinkIcon } from '../../components/auth/PasswordLinkPage.jsx';
import { STAFF_LOGIN_PATH } from '../../lib/auth.js';
import { FONT_SERIF } from '../../styles/fonts.js';

const COPY = {
  checking: 'Checking your setup link…',
  formTitle: 'Set up your account',
  submitLabel: 'Save password and finish',
};

function DeadSetupLink() {
  return (
    <div>
      <BrokenLinkIcon />
      <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
        This setup link has expired or already been used
      </h1>
      <p className="ts-soft mt-3 text-base leading-relaxed">
        Setup links work for 3 days and only once. Ask your administrator to send you a new one.
      </p>
      <p className="ts-soft mt-3 text-base leading-relaxed">
        Already chose your password?{' '}
        <a href={STAFF_LOGIN_PATH} className="ts-link font-medium">
          Log in to the Staff Portal
        </a>
        .
      </p>
    </div>
  );
}

// Where the "Set up your TrailSync account" email leads: an admin-created staff member chooses their first password.
export default function AccountSetupPage() {
  return (
    <PasswordLinkPage
      audience="staff"
      validatePath="/api/auth/account-setup/validate/"
      confirmPath="/api/auth/account-setup/confirm/"
      flash="account_ready"
      copy={COPY}
      renderDead={() => <DeadSetupLink />}
      renderIntro={(info) => (
        <p className="ts-soft mt-2 text-sm leading-relaxed">
          Welcome{info?.first_name ? `, ${info.first_name}` : ''}. Choose the password you&rsquo;ll use to log in
          {info?.email ? (
            <>
              {' '}
              as <strong className="ts-ink break-all">{info.email}</strong>
            </>
          ) : null}
          . Nobody else, including your administrator, will ever see it.
        </p>
      )}
    />
  );
}
