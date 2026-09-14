"""Email confirmation for self-registered students.

Nothing about a link is stored in the database. The token is an HMAC signed
with SECRET_KEY over the account's id, its email and whether it is already
verified, plus a timestamp - Django's password-reset token mechanism, with its
own salt so a password-reset token can never activate an account (or the
reverse). Because the verified flag is part of what is signed, a link stops
working the moment it has been used, and changing the account's email kills
any link sent to the old address.
"""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode

from .models import User

# Long enough that "I'll do it tonight" still works; short enough that a link
# found in an old inbox is dead. Stated in the email itself.
ACTIVATION_TIMEOUT = timedelta(hours=24)
ACTIVATION_TIMEOUT_TEXT = "24 hours"


class EmailActivationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "TrailSync.activation.EmailActivationTokenGenerator"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{int(bool(user.email_verified))}{timestamp}"

    def verify(self, user, token):
        """'ok', 'expired' or 'invalid'.

        Django's own check_token answers False for both a forged token and a
        genuine-but-old one. Those need different pages - "this link has
        expired, here's a new one" is not the same message as "this link is
        wrong" - so the checks are done here in order: signature first, then
        age. A tampered token can therefore never be reported as merely
        expired.
        """
        if not (user and token):
            return "invalid"
        try:
            ts_b36, _ = token.split("-")
            ts = base36_to_int(ts_b36)
        except ValueError:
            return "invalid"

        for secret in [self.secret, *self.secret_fallbacks]:
            if constant_time_compare(self._make_token_with_timestamp(user, ts, secret), token):
                break
        else:
            return "invalid"

        if (self._num_seconds(self._now()) - ts) > ACTIVATION_TIMEOUT.total_seconds():
            return "expired"
        return "ok"


activation_token = EmailActivationTokenGenerator()


def user_from_uid(uid):
    """The User an activation link's uid names, or None for anything malformed."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        return User.objects.get(pk=pk)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def activation_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = activation_token.make_token(user)
    # Points at the React app, not the API: the browser opens a page, and
    # that page POSTs the token. A plain GET that activated and logged in on
    # arrival would also be triggered by the link scanners many mail
    # providers run over incoming messages.
    return f"{settings.FRONTEND_BASE_URL}/activate?uid={uid}&token={token}"


def send_activation_email(user):
    """Send (or re-send) the confirmation email. Each send mints a fresh link."""
    context = {
        "link": activation_link(user),
        "expires": ACTIVATION_TIMEOUT_TEXT,
        "logo_url": f"{settings.FRONTEND_BASE_URL}/trailsync-logo.png",
        "email": user.email,
    }
    message = EmailMultiAlternatives(
        subject="Confirm your TrailSync account",
        body=render_to_string("emails/activation.txt", context),
        from_email=None,  # DEFAULT_FROM_EMAIL
        to=[user.email],
    )
    message.attach_alternative(render_to_string("emails/activation.html", context), "text/html")
    message.send()
