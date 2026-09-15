import { useState } from 'react';
import { GlassScene } from '../../components/layout/GlassScene.jsx';
import {
  AuthHeader,
  BackToLogin,
  resetAudience,
  ResetLinkRequestForm,
  ResetLinkSent,
} from '../../components/auth/ResetLink.jsx';
import { FONT_SERIF } from '../../styles/fonts.js';

export default function ForgotPasswordPage() {
  const audience = resetAudience();
  const [sent, setSent] = useState(null);

  return (
    <GlassScene maxWidth="420px" variant={audience}>
      <AuthHeader audience={audience} />

      <div className="mt-8" aria-live="polite">
        {sent ? (
          <ResetLinkSent sent={sent} onAgain={() => setSent(null)} />
        ) : (
          <>
            <h1 className="ts-ink text-3xl font-semibold tracking-tight" style={FONT_SERIF}>
              Forgot your password?
            </h1>
            <p className="ts-soft mt-2 text-sm leading-relaxed">
              Enter the email address you use for TrailSync and we&rsquo;ll send you a link to choose a new password.
            </p>
            <div className="mt-7">
              <ResetLinkRequestForm autoFocus onSent={setSent} />
            </div>
          </>
        )}
      </div>

      <BackToLogin audience={audience} />
    </GlassScene>
  );
}
