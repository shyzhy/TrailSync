import { useState } from 'react';
import PasswordLinkPage, { BrokenLinkIcon } from '../../components/auth/PasswordLinkPage.jsx';
import { resetAudience, ResetLinkRequestForm, ResetLinkSent } from '../../components/auth/ResetLink.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';

const COPY = {
  checking: 'Checking your reset link…',
  formTitle: 'Choose a new password',
  formIntro: 'Pick something you haven’t used before. Once it’s saved, you’ll log in with it.',
  submitLabel: 'Save new password',
};

// A dead reset link can ask for a fresh one right there.
function DeadResetLink() {
  const [sent, setSent] = useState(null);
  if (sent) return <ResetLinkSent sent={sent} onAgain={() => setSent(null)} />;
  return (
    <div>
      <BrokenLinkIcon />
      <h1 className="ts-ink mt-5 text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
        This reset link has expired or already been used
      </h1>
      <p className="ts-soft mt-3 text-base leading-relaxed">
        Reset links work for 1 hour and only once. Enter your email and we&rsquo;ll send you a new one.
      </p>
      <div className="mt-6">
        <ResetLinkRequestForm idPrefix="newLink" onSent={setSent} />
      </div>
    </div>
  );
}

// Where the reset email leads. The link is checked on arrival, and success sends the person to log in rather than signing them in.
export default function ResetPasswordPage() {
  const [audience] = useState(resetAudience);
  return (
    <PasswordLinkPage
      audience={audience}
      validatePath="/api/auth/password-reset/validate/"
      confirmPath="/api/auth/password-reset/confirm/"
      flash="password_reset"
      copy={COPY}
      renderDead={() => <DeadResetLink />}
    />
  );
}
