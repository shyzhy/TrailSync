"""Emailed account links (confirm an address, reset a password): signed, expiring tokens with nothing stored in the database."""
import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.db import connection
from django.template.loader import render_to_string
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode

from .models import Role, User

logger = logging.getLogger(__name__)


class TimedLinkTokenGenerator(PasswordResetTokenGenerator):
    """Django's token scheme, with its own timeout and a reason on failure."""

    timeout = timedelta(hours=1)
    timeout_text = "1 hour"

    def verify(self, user, token):
        """'ok', 'expired' or 'invalid': the signature is checked before age, so a forged token is never reported as merely expired."""
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

        if (self._num_seconds(self._now()) - ts) > self.timeout.total_seconds():
            return "expired"
        return "ok"


class EmailActivationTokenGenerator(TimedLinkTokenGenerator):
    # Unchanged from activation.py: a new salt would break every confirmation link already in an inbox.
    key_salt = "TrailSync.activation.EmailActivationTokenGenerator"
    # Long enough that "I'll do it tonight" still works.
    timeout = timedelta(hours=24)
    timeout_text = "24 hours"

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{int(bool(user.email_verified))}{timestamp}"


class PasswordResetLinkTokenGenerator(TimedLinkTokenGenerator):
    key_salt = "TrailSync.account_links.PasswordResetLinkTokenGenerator"
    # Short: a reset link is a key to the account for as long as it works.
    timeout = timedelta(hours=1)
    timeout_text = "1 hour"

    def _make_hash_value(self, user, timestamp):
        # The password hash makes the link single-use; the email kills links sent before an address change.
        login = "" if user.last_login is None else user.last_login.replace(microsecond=0, tzinfo=None)
        return f"{user.pk}{user.password}{login}{user.email}{timestamp}"


class AccountSetupTokenGenerator(PasswordResetLinkTokenGenerator):
    """The first-password link for an admin-created staff account; single-use for the same reason as a reset link."""

    key_salt = "TrailSync.account_links.AccountSetupTokenGenerator"
    # Long enough for someone who only checks email on workdays.
    timeout = timedelta(hours=72)
    timeout_text = "3 days"


activation_token = EmailActivationTokenGenerator()
password_reset_token = PasswordResetLinkTokenGenerator()
account_setup_token = AccountSetupTokenGenerator()


def user_from_uid(uid):
    """The User a link's uid names, or None for anything malformed."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        return User.objects.get(pk=pk)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def _uid(user):
    return urlsafe_base64_encode(force_bytes(user.pk))


def activation_link(user):
    # Points at the React app, which POSTs the token: mail scanners open every link with a GET.
    return f"{settings.FRONTEND_BASE_URL}/activate?uid={_uid(user)}&token={activation_token.make_token(user)}"


def login_audience(user):
    """Which login page an account belongs to: 'admin', 'staff' or 'student'."""
    role = user.role.role_name if user.role_id else None
    if role == Role.RoleName.ADMIN:
        return "admin"
    if role == Role.RoleName.REGISTRAR:
        return "staff"
    return "student"


def password_reset_link(user):
    # Which login to return to is decided from the account, never from anything the requester sent.
    return (
        f"{settings.FRONTEND_BASE_URL}/reset-password?uid={_uid(user)}"
        f"&token={password_reset_token.make_token(user)}&from={login_audience(user)}"
    )


def account_setup_link(user):
    return f"{settings.FRONTEND_BASE_URL}/account-setup?uid={_uid(user)}&token={account_setup_token.make_token(user)}"


def _build(template, subject, user, link, expires):
    context = {
        "link": link,
        "expires": expires,
        "logo_url": f"{settings.FRONTEND_BASE_URL}/trailsync-logo.png",
        "email": user.email,
        "first_name": user.first_name or "there",
    }
    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string(f"emails/{template}.txt", context),
        from_email=None,
        to=[user.email],
    )
    message.attach_alternative(render_to_string(f"emails/{template}.html", context), "text/html")
    return message


def _send_in_background(build):
    """Build and send an email after the response, so timing never reveals whether an account exists."""

    def run():
        message = None
        try:
            message = build()
            message.send()
        except Exception:  # noqa: BLE001 - a failed send must be logged, never raised into a dead thread
            logger.exception("Could not send %r", getattr(message, "subject", "account email"))
        finally:
            connection.close()

    threading.Thread(target=run, daemon=True).start()


def send_activation_email(user, background=False):
    """Send (or re-send) the confirmation email. Each send mints a fresh link."""
    def build():
        return _build(
            "activation", "Confirm your TrailSync account", user, activation_link(user), activation_token.timeout_text
        )

    if background:
        _send_in_background(build)
    else:
        build().send()


def send_password_reset_email(user):
    _send_in_background(
        lambda: _build(
            "password_reset",
            "Reset your TrailSync password",
            user,
            password_reset_link(user),
            password_reset_token.timeout_text,
        )
    )


def send_account_setup_email(user, background=False):
    """Send the setup link; synchronous by default, so an admin is told if it could not be sent."""
    def build():
        return _build(
            "account_setup", "Set up your TrailSync account", user, account_setup_link(user), account_setup_token.timeout_text
        )

    if background:
        _send_in_background(build)
    else:
        build().send()
