import calendar
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import models
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .exports import build_released_workbook
from .official_form import build_official_form_pdf
from .receipts import build_claim_stub_pdf
from .avatars import AvatarRejected, process_avatar
from .models import (
    RELEASE_TIME_END,
    RELEASE_TIME_START,
    FormRequest,
    Notification,
    ReleaseSchedule,
    RequirementVerification,
    Role,
    StaffProfile,
    TransactionType,
    User,
)
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .account_links import (
    activation_token,
    password_reset_token,
    send_activation_email,
    send_password_reset_email,
    user_from_uid,
)
from .serializers import (
    ONBOARDING_STEPS,
    ActivateAccountSerializer,
    ApproveLogSerializer,
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    CreateFormRequestSerializer,
    FormRequestResultSerializer,
    MarkReadySerializer,
    MeSerializer,
    NotificationSerializer,
    RecentFormRequestSerializer,
    RegisterSerializer,
    ResendActivationSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetLinkSerializer,
    PasswordResetRequestSerializer,
    RegistrarQueueRowSerializer,
    RegistrarRecentSubmissionSerializer,
    RegistrarReleasedRowSerializer,
    RegistrarTodaysPickupRowSerializer,
    RejectRequestSerializer,
    ReleaseRequestSerializer,
    TrackedFormRequestSerializer,
    TransactionTypeSerializer,
    UpdateProfileSerializer,
    VerifyRequestSerializer,
    build_profile_payload,
)


class IsApprovedRegistrarStaff(BasePermission):
    """Gate for every registrar-facing endpoint below.

    Mirrors the exact check LoginView already does at login time — role is
    Registrar Staff AND staff_profile.approval_status is Approved — so a
    pending or rejected staff account (or a student token, or a Registrar
    Staff account that was later un-approved) gets a 403 here even if it
    somehow still holds a valid JWT.
    """

    message = "Only approved registrar staff may access this."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if not user.role_id or user.role.role_name != Role.RoleName.REGISTRAR:
            return False
        staff_profile = getattr(user, "staff_profile", None)
        return bool(staff_profile and staff_profile.approval_status == StaffProfile.ApprovalStatus.APPROVED)


class RegisterView(APIView):
    """POST /api/auth/register/ - create an account and email a confirmation link.

    Returns no tokens: the account cannot be used until the address is
    confirmed (see LoginView and ActivateAccountView). Throttled, because each
    call sends an email to whatever address it is given.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        # raise_exception=True turns serializer errors into a 400 whose body is
        # {"field": ["message"]}, which is what the React form maps to its
        # per-field inline errors.
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_activation_email(user)

        return Response(
            {
                "detail": "Account created. Check your email to activate it.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = (request.data.get("identifier") or "").strip()
        password = request.data.get("password") or ""

        if not identifier or not password:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        candidate = (
            User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(user_profile__school_id_number__iexact=identifier).first()
        )
        if candidate is None:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = authenticate(request, username=candidate.email, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.status != "Active":
            return Response(
                {"detail": "Your account is suspended. Contact the registrar's office."},
                status=status.HTTP_403_FORBIDDEN,
            )

        role_name = user.role.role_name if user.role_id else None

        # Same shape as the staff-approval block below: the password was
        # right (so nothing is revealed to someone guessing), but the account
        # isn't usable yet. Scoped to self-registered roles - staff accounts
        # are provisioned by an admin, not confirmed by email.
        if role_name in SELF_REGISTERED_ROLES and not user.email_verified:
            return Response(
                {
                    "code": "email_unverified",
                    "detail": "Please confirm your email before logging in.",
                    "email": user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if role_name == Role.RoleName.REGISTRAR:
            staff_profile = getattr(user, "staff_profile", None)
            if (
                staff_profile is None
                or staff_profile.approval_status != StaffProfile.ApprovalStatus.APPROVED
            ):
                return Response(
                    {"detail": "Your staff account is pending admin approval. You'll be notified once it's activated."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        return Response(_session_payload(user), status=status.HTTP_200_OK)


def _session_payload(user):
    """Tokens plus the user, in the shape the frontend saves as a session.

    Shared by login and account activation, so someone who arrives through
    their confirmation link holds exactly what a normal login would give them.
    """
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role.role_name if user.role_id else None,
            "profile": build_profile_payload(user),
        },
    }


SELF_REGISTERED_ROLES = (Role.RoleName.STUDENT, Role.RoleName.ALUMNI)


class ActivateAccountView(APIView):
    """POST /api/auth/activate/ {uid, token} - the link from the confirmation email.

    On success the address is marked verified and the student is signed in
    straight away, so they land in onboarding rather than on a login form
    asking for the password they typed two minutes ago.

    Answers carry a `code` the page switches on:
      already_active - the link was used before; log in normally
      expired        - genuine but older than 24 hours; offer a new one
      invalid        - malformed, tampered with, or superseded
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "activation"

    def post(self, request):
        serializer = ActivateAccountSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"code": "invalid", "detail": "This link isn't complete. Try opening it from the email again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = user_from_uid(serializer.validated_data["uid"])
        if user is None:
            return Response(
                {"code": "invalid", "detail": "This link isn't valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.email_verified:
            # Checked before the token, because using a link flips the flag
            # the token is signed over - a second click would otherwise read
            # as a broken link rather than as "you're already in".
            return Response(
                {"code": "already_active", "detail": "Your account is already active.", "email": user.email},
                status=status.HTTP_409_CONFLICT,
            )

        result = activation_token.verify(user, serializer.validated_data["token"])
        if result == "expired":
            return Response(
                {"code": "expired", "detail": "This link has expired.", "email": user.email},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if result != "ok":
            return Response(
                {"code": "invalid", "detail": "This link isn't valid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.status != "Active":
            return Response(
                {"code": "suspended", "detail": "Your account is suspended. Contact the registrar's office."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified", "email_verified_at"])
        return Response(_session_payload(user), status=status.HTTP_200_OK)


class ResendActivationView(APIView):
    """POST /api/auth/resend-activation/ {email} - send a fresh confirmation link.

    Always answers the same way, whether or not the address has an account
    and whether or not it is already confirmed. Anything else would let this
    endpoint be used to check who is registered. Throttled, since each call
    can send an email.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "activation_resend"

    def post(self, request):
        serializer = ResendActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip()

        user = (
            User.objects.filter(
                email__iexact=email,
                email_verified=False,
                role__role_name__in=SELF_REGISTERED_ROLES,
            )
            .select_related("role")
            .first()
        )
        if user is not None:
            # Background, for the same timing reason as password reset: the
            # answer must not take longer only when the account exists.
            send_activation_email(user, background=True)

        return Response(
            {
                "detail": (
                    "If that email belongs to an account that still needs confirming, "
                    "we've sent a new link. It can take a minute or two to arrive."
                )
            }
        )


PASSWORD_RESET_SENT = (
    "If an account exists for this email, we've sent a reset link. "
    "It can take a minute or two to arrive."
)


class PasswordResetRequestView(APIView):
    """POST /api/auth/password-reset/ {email} - email a reset link if the account exists.

    The answer is identical, word for word and in timing, whether or not the
    address is registered: the email goes out on a background thread, so the
    response never waits on the mail server only for real accounts. One flow
    for students and staff alike - resetting a password doesn't depend on role.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = (
            User.objects.filter(email__iexact=serializer.validated_data["email"].strip(), status="Active")
            .select_related("role")
            .first()
        )
        if user is not None and user.has_usable_password():
            send_password_reset_email(user)
        return Response({"detail": PASSWORD_RESET_SENT})


def _reset_link_user(serializer):
    """(user, None) for a usable reset link, or (None, error Response).

    Expired and already-used links are reported the same way on purpose:
    both mean "ask for a new one", and a used link fails the signature check
    (the password it was signed over has changed), so the two can't be told
    apart honestly anyway.
    """
    user = user_from_uid(serializer.validated_data["uid"])
    result = password_reset_token.verify(user, serializer.validated_data["token"]) if user else "invalid"
    if result != "ok":
        return None, Response(
            {"code": result, "detail": "This reset link has expired or already been used."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return user, None


class PasswordResetValidateView(APIView):
    """POST /api/auth/password-reset/validate/ {uid, token} - is this link still good?

    Asked when the reset page opens, so someone with a dead link is told so
    straight away instead of after choosing and typing a new password.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"code": "invalid", "detail": "This reset link has expired or already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        _, error = _reset_link_user(serializer)
        return error or Response({"valid": True})


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm/ {uid, token, new_password, confirm_new_password}.

    Sets the new password and deliberately does NOT sign the person in: they
    log in fresh with it, which is also the moment they find out it works.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, error = _reset_link_user(serializer)
        if error:
            return error

        data = serializer.validated_data
        if data["new_password"] != data["confirm_new_password"]:
            return Response(
                {"confirm_new_password": ["Passwords don't match."]}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            validate_password(data["new_password"], user)
        except DjangoValidationError as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data["new_password"])
        fields = ["password"]
        # Opening this link proved they read that inbox - the same thing the
        # activation link proves - so an unconfirmed account is confirmed too,
        # rather than resetting the password only to be refused at login.
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = timezone.now()
            fields += ["email_verified", "email_verified_at"]
        user.save(update_fields=fields)

        is_staff = bool(user.role_id and user.role.role_name == Role.RoleName.REGISTRAR)
        return Response({"detail": "Your password has been changed.", "login": "staff" if is_staff else "student"})


# What a filed request was made under. Year level moves on every year and
# academic level/graduation date were never asked before, so those stay open.
LOCKED_ACADEMIC_FIELDS = ("school_id_number", "course", "user_category")


class MeOnboardingView(APIView):
    """PATCH /api/me/onboarding/ {step, ...fields} - save one wizard step.

    Saved step by step so closing the browser loses nothing. The response is
    the full /api/me/ payload, whose profile.onboarding says which step is
    next - the wizard never has to work that out for itself.

    Academic details (ID number, course, category) are official records.
    They can be set here while the student has never filed a request; once a
    request exists, changes go through Window 6 like any other record change.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request):
        profile = getattr(request.user, "user_profile", None)
        if profile is None:
            return Response(
                {"detail": "Account setup is only for student and alumni accounts."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        step = request.data.get("step")
        serializer_class = ONBOARDING_STEPS.get(step)
        if serializer_class is None:
            return Response(
                {"step": [f"Unknown step. Use one of: {', '.join(ONBOARDING_STEPS)}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = serializer_class(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)

        # The lock is on CHANGING a record a request was filed under, not on
        # filling a blank: an account that already has requests but predates
        # academic_level must still be able to finish onboarding, or it would
        # be asked for a field it is then forbidden to save.
        if step == "academic" and request.user.form_requests.exists():
            changed = [
                field
                for field in LOCKED_ACADEMIC_FIELDS
                if getattr(profile, field)
                and str(serializer.validated_data.get(field) or "").strip().lower()
                != str(getattr(profile, field)).strip().lower()
            ]
            if changed:
                return Response(
                    {
                        "detail": (
                            "Your School ID number, course and category are already on file with "
                            "a request. To change them, please ask at Window 6."
                        ),
                        "locked_fields": changed,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer.save(request.user)
        return Response(MeSerializer(request.user).data)


class MeView(APIView):
    """GET /api/me/ - who the current token belongs to.

    Exists so the dashboard can refresh identity/profile on a page load
    without re-running login (e.g. after a hard refresh, or once the access
    token has outlived whatever was cached client-side from login).

    PATCH updates the Profile page's editable "Personal Information" fields
    only (see UpdateProfileSerializer) — school ID, course, category, and
    year level are official records and stay read-only here.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class MeAvatarView(APIView):
    """PATCH /api/me/avatar/ - set or replace the profile picture.
    DELETE /api/me/avatar/ - remove it, reverting to initials everywhere.

    Its own endpoint rather than a field on PATCH /api/me/: an image upload is
    multipart, the Personal Information form is JSON, and mixing the two would
    make every name edit a multipart request and every photo change carry the
    whole form along with it.

    The upload is re-validated and re-encoded here regardless of what the
    browser already did (see avatars.process_avatar) - this endpoint can be
    called directly, and the client's checks are a convenience, not a guard.

    Students and alumni only. Staff accounts have a StaffProfile rather than a
    UserProfile, so there is nowhere to store one; they keep their initials.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _profile_or_error(self, request):
        profile = getattr(request.user, "user_profile", None)
        if profile is None:
            return None, Response(
                {"detail": "Profile pictures are only available on student accounts."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return profile, None

    def patch(self, request):
        profile, error = self._profile_or_error(request)
        if error:
            return error

        uploaded = request.FILES.get("image")
        if uploaded is None:
            return Response(
                {"image": ["Choose an image to upload."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            processed = process_avatar(uploaded)
        except AvatarRejected as exc:
            return Response({"image": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        # Write the new file before removing the old one, so a failure
        # halfway through leaves the student with the photo they had rather
        # than with none.
        previous = profile.profile_picture.name if profile.profile_picture else None
        profile.profile_picture.save(processed.name, processed, save=False)
        profile.save(update_fields=["profile_picture", "updated_at"])
        if previous and previous != profile.profile_picture.name:
            profile.profile_picture.storage.delete(previous)

        return Response(MeSerializer(request.user).data)

    def delete(self, request):
        profile, error = self._profile_or_error(request)
        if error:
            return error

        if profile.profile_picture:
            # delete(save=False) removes the file from storage; the column is
            # then cleared explicitly so the row never points at a missing file.
            profile.profile_picture.delete(save=False)
        profile.profile_picture = None
        profile.save(update_fields=["profile_picture", "updated_at"])
        return Response(MeSerializer(request.user).data)


class MeTourView(APIView):
    """POST /api/me/tour/ - the student finished or skipped the walkthrough.

    Idempotent: replaying the tour from the Help button later does not move
    the original timestamp, which records when they first saw it.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "user_profile", None)
        if profile is None:
            return Response(
                {"detail": "The walkthrough is only for student accounts."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if profile.tour_completed_at is None:
            profile.tour_completed_at = timezone.now()
            profile.save(update_fields=["tour_completed_at", "updated_at"])
        return Response(MeSerializer(request.user).data)


class ChangePasswordView(APIView):
    """POST /api/me/change-password/ - Profile page's Change Password card."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Your password has been updated."})


class ChangeEmailRequestView(APIView):
    """POST /api/me/change-email/request/ - step 1 of the email-change flow:
    validate the new address and mail a confirmation link to it. The
    account's actual email is untouched until that link is used (see
    ChangeEmailConfirmView) — this only ever sends mail to the NEW address,
    never changes anything by itself.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangeEmailRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data["new_email"]

        signer = TimestampSigner()
        token = signer.sign_object({"user_id": request.user.id, "new_email": new_email})
        # Points at the React app, not this API — clicking an emailed link is
        # a browser GET, and the confirmation should render as a page (the
        # frontend reads ?token= and POSTs it to change-email/confirm/ itself).
        verify_url = f"{settings.FRONTEND_BASE_URL}/confirm-email?token={token}"

        # EMAIL_BACKEND is the console backend in dev (see settings.py) — this
        # really runs, it just prints to the runserver log instead of an inbox.
        send_mail(
            subject="Confirm your new TrailSync email",
            message=(
                f"Hi {request.user.first_name},\n\n"
                f"Click the link below to confirm {new_email} as your new TrailSync login email:\n\n"
                f"{verify_url}\n\n"
                "This link expires in 1 hour. If you didn't request this change, you can ignore it."
            ),
            from_email=None,
            recipient_list=[new_email],
        )
        return Response({"detail": f"A verification link was sent to {new_email}."})


class ChangeEmailConfirmView(APIView):
    """POST /api/me/change-email/confirm/ - step 2: the token from that link
    actually flips USERS.email, after re-checking the address is still free."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangeEmailConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        signer = TimestampSigner()
        try:
            payload = signer.unsign_object(serializer.validated_data["token"], max_age=3600)
        except (BadSignature, SignatureExpired):
            return Response({"detail": "This verification link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if payload.get("user_id") != request.user.id:
            return Response(
                {"detail": "This verification link doesn't belong to your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_email = payload.get("new_email")
        if User.objects.exclude(pk=request.user.pk).filter(email__iexact=new_email).exists():
            return Response({"detail": "That email is now in use by another account."}, status=status.HTTP_400_BAD_REQUEST)

        request.user.email = new_email
        request.user.save(update_fields=["email"])
        return Response({"detail": "Your email has been updated.", "email": new_email})


class DashboardSummaryView(APIView):
    """GET /api/dashboard/summary/ - the three student home-screen stat cards.

    Every count is filtered by user=request.user first — the request never
    chooses whose data it sees, so one student can't page through another's
    counts by any parameter tampering.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = FormRequest.objects.filter(user=request.user)
        current_year = timezone.now().year

        active_requests_count = base.filter(
            request_status__in=[
                FormRequest.RequestStatus.SUBMITTED,
                FormRequest.RequestStatus.APPROVED,
                FormRequest.RequestStatus.PROCESSING,
            ]
        ).count()
        ready_for_pickup_count = base.filter(request_status=FormRequest.RequestStatus.READY).count()
        released_this_year_count = base.filter(
            request_status=FormRequest.RequestStatus.RELEASED,
            created_at__year=current_year,
        ).count()

        return Response(
            {
                "active_requests_count": active_requests_count,
                "ready_for_pickup_count": ready_for_pickup_count,
                "released_this_year_count": released_this_year_count,
            }
        )


class RecentFormRequestsView(generics.ListAPIView):
    """GET /api/dashboard/recent-requests/ - the student's latest 5 requests."""

    serializer_class = RecentFormRequestSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # select_related avoids an N+1 for transaction_type.name on each row.
        return (
            FormRequest.objects.filter(user=self.request.user)
            .select_related("transaction_type")
            .order_by("-created_at")[:5]
        )


class UpcomingReleaseDatesView(APIView):
    """GET /api/dashboard/upcoming-release-dates/ - ISO dates (deduped) the
    logged-in student has a request booked against, today or later. Powers
    the dashboard calendar's "something's scheduled" dots — purely additive,
    a student with none just gets an empty list.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Reads the schedule, which is what Mark Ready to Release writes.
        # This used to read FormRequest.release_slot, so once the slot picker
        # was removed every dot on the student's calendar would have
        # disappeared.
        dates = FormRequest.objects.filter(
            user=request.user,
            release_schedule__release_date__gte=timezone.localdate(),
        ).values_list("release_schedule__release_date", flat=True)

        # Deduping in Python rather than via .distinct(): FormRequest's
        # default ordering (-created_at) gets pulled into the query when you
        # chain .distinct() after .values_list(), which makes DISTINCT
        # compare on created_at too and silently defeats it — every row has
        # a different created_at, so nothing gets collapsed.
        unique_dates = sorted(set(dates))
        return Response({"dates": [d.isoformat() for d in unique_dates]})


class TransactionTypeListView(generics.ListAPIView):
    """GET /api/transaction-types/ - the Request a Form document dropdown."""

    serializer_class = TransactionTypeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = TransactionType.objects.all().order_by("name")


class FormRequestPagination(PageNumberPagination):
    """Reports the exact start/end index of the current page so the Track
    Requests page can render "Showing X–Y of Z" without recomputing offsets
    (and risking an off-by-one) on the client."""

    page_size = 6
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(self, data):
        per_page = self.page.paginator.per_page
        start = (self.page.number - 1) * per_page + 1
        end = start + len(data) - 1
        return Response(
            {
                "count": self.page.paginator.count,
                "start": start if data else 0,
                "end": end if data else 0,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            }
        )


class FormRequestListCreateView(generics.ListCreateAPIView):
    """GET /api/form-requests/ - the Track Requests list: the logged-in
    student's own requests, newest first, filterable by ?status= and
    ?search= (request code), paginated.

    POST /api/form-requests/ - submit a new document request. request_status,
    request_code, and the owning user are all set server-side (see
    CreateFormRequestSerializer) — none of them are accepted from the
    client, so a request can't be filed under someone else's account or
    created in a status other than Submitted. create() is overridden because
    the default ListCreateAPIView response would echo back the write-only
    CreateFormRequestSerializer shape instead of FormRequestResultSerializer.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = FormRequestPagination

    def get_serializer_class(self):
        return CreateFormRequestSerializer if self.request.method == "POST" else TrackedFormRequestSerializer

    def get_queryset(self):
        qs = (
            FormRequest.objects.filter(user=self.request.user)
            .select_related("transaction_type", "submission", "release_slot", "proxy", "release_schedule")
            .order_by("-created_at")
        )

        status_param = (self.request.query_params.get("status") or "").strip()
        if status_param and status_param.lower() != "all":
            qs = qs.filter(request_status__iexact=status_param)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(request_code__icontains=search)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateFormRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        form_request = serializer.save()
        return Response(FormRequestResultSerializer(form_request).data, status=status.HTTP_201_CREATED)


def _releases_between(first_day, last_day):
    """Requests whose handover falls on a date in [first_day, last_day].

    The one rule every "when is this being released" view shares: the
    ReleaseSchedule date that Mark Ready to Release writes, or - only for a
    request that has no schedule date at all - the ReleaseSlot it was booked
    into before slots were retired. That is the same precedence as
    FormRequest.scheduled_release(), expressed as a query so it can be
    counted without loading every row.

    Before this existed the dashboard counted schedule dates only, so a
    request booked under the old slot system was invisible there while
    still showing its window to the student.
    """
    return FormRequest.objects.filter(
        models.Q(release_schedule__release_date__range=(first_day, last_day))
        | models.Q(
            release_schedule__release_date__isnull=True,
            release_slot__slot_date__range=(first_day, last_day),
        )
    )


def _effective_release_date(schedule_date, slot_date):
    return schedule_date or slot_date


def _release_window_text():
    """"3:00 PM to 5:00 PM" - the one window Window 6 releases in.

    Built here rather than with strftime's %-I, which is not portable (it
    raises on Windows, where this project is developed).
    """
    fmt = lambda t: f"{t:%I:%M %p}".lstrip("0")  # noqa: E731
    return f"{fmt(RELEASE_TIME_START)} and {fmt(RELEASE_TIME_END)}"


class RegistrarDashboardSummaryView(APIView):
    """GET /api/registrar/dashboard/summary/ - the four Registrar Dashboard
    stat cards.

    There is no per-request "window" column anywhere in FormRequest — every
    request in this system is already implicitly Window 6 (there's only one
    window, per every page's own copy) — so these counts are NOT scoped by
    staff_profile.assigned_window; there's no real per-request data to scope
    by. If multi-window support is added later, this is the place a
    `.filter(window=...)` would go in.

    Two of the four counts lean on updated_at as a stand-in for a dedicated
    timestamp that doesn't exist yet (no verified_at/released_at columns,
    no REQUIREMENT_VERIFICATIONS table) — see the per-field comments below.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())  # Monday

        pending_review_count = FormRequest.objects.filter(
            request_status=FormRequest.RequestStatus.SUBMITTED
        ).count()

        # A real event count now, no longer a proxy: RequirementVerification
        # records each decision with its own verified_at, so this counts
        # approvals that actually happened today rather than requests that
        # merely sit at Approved and were last written today (which double
        # counted a request edited later the same day, and lost one approved
        # yesterday but touched today).
        verified_today_count = RequirementVerification.objects.filter(
            verification_status=RequirementVerification.VerificationStatus.VERIFIED,
            verified_at__date=today,
        ).count()

        # "For release today" = scheduled for handover today. Counted off
        # ReleaseSchedule.release_date now that Mark Ready to Release writes
        # it directly; the old ReleaseSlot count would read 0 forever.
        for_release_today_count = _releases_between(today, today).count()

        completed_this_week_count = FormRequest.objects.filter(
            request_status=FormRequest.RequestStatus.RELEASED,
            updated_at__date__gte=week_start,
        ).count()

        return Response(
            {
                "pending_review_count": pending_review_count,
                "verified_today_count": verified_today_count,
                "for_release_today_count": for_release_today_count,
                "completed_this_week_count": completed_this_week_count,
            }
        )


class RegistrarRecentSubmissionsView(generics.ListAPIView):
    """GET /api/registrar/dashboard/recent-submissions/ - latest 5 requests
    across the (single) queue, for the Dashboard's "Recent Submissions" card."""

    serializer_class = RegistrarRecentSubmissionSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        return (
            FormRequest.objects.select_related("transaction_type", "user")
            .order_by("-created_at")[:5]
        )


class RegistrarTodaysPickupsView(generics.ListAPIView):
    """GET /api/registrar/dashboard/todays-pickups/ - requests scheduled for
    handover today, for the Dashboard's "Today's Pickups" card."""

    serializer_class = RegistrarTodaysPickupRowSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        today = timezone.localdate()
        return (
            _releases_between(today, today)
            .select_related("transaction_type", "user", "release_schedule", "release_slot")
            .order_by("release_schedule__release_time_start", "request_code")
        )


class RegistrarReleaseCalendarView(APIView):
    """GET /api/registrar/release-calendar/?year=&month= - dates and counts only.

    Deliberately thin: the month grid needs to know which days have releases
    and how many, not who they are. Detail for one day comes from the day
    endpoint below, only when a date is actually opened.

    Read-only by design. Scheduling happens on the Request Review page and
    nowhere else, so there is no write path here to keep in sync with it.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        today = timezone.localdate()
        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
            first_day = date(year, month, 1)
        except (TypeError, ValueError):
            return Response(
                {"detail": "Use a real year and month, for example ?year=2026&month=9."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        last_day = date(year, month, calendar.monthrange(year, month)[1])

        counts = {}
        rows = _releases_between(first_day, last_day).values_list(
            "release_schedule__release_date", "release_slot__slot_date"
        )
        for schedule_date, slot_date in rows:
            day = _effective_release_date(schedule_date, slot_date)
            if first_day <= day <= last_day:
                counts[day] = counts.get(day, 0) + 1

        return Response(
            {
                "year": year,
                "month": month,
                "days": [{"date": d.isoformat(), "count": counts[d]} for d in sorted(counts)],
            }
        )


class RegistrarReleaseCalendarDayView(APIView):
    """GET /api/registrar/release-calendar/day/?date=YYYY-MM-DD - who is due that day.

    Name, request code and document per release, plus whether it has been
    collected yet so a glance at a past day reads correctly. No actions.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        try:
            day = date.fromisoformat((request.query_params.get("date") or "").strip())
        except ValueError:
            return Response(
                {"detail": "Use a real date, for example ?date=2026-09-18."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        releases = (
            _releases_between(day, day)
            .select_related("transaction_type", "user", "release_schedule", "release_slot")
            .order_by("request_code")
        )
        rows = []
        for fr in releases:
            when = fr.scheduled_release()
            start = when[1] if when else None
            rows.append(
                {
                    "id": fr.id,
                    "request_code": fr.request_code,
                    "student_name": fr.user.get_full_name() or fr.user.email,
                    "transaction_type": fr.transaction_type.name,
                    "request_status": fr.request_status,
                    "release_time_start": start.isoformat(timespec="minutes") if start else None,
                }
            )
        rows.sort(key=lambda r: (r["release_time_start"] or "", r["request_code"]))
        return Response({"date": day.isoformat(), "releases": rows})


class RegistrarQueueListView(generics.ListAPIView):
    """GET /api/registrar/queue/ - Processing Queue's left-hand list.

    Filterable by ?status= (defaults to Submitted — the UI's "Pending"),
    ?date_from=/?date_to= (against created_at), and ?search= (student name
    or request code). Not scoped by assigned_window: there's no per-request
    window column, same reality noted on the Dashboard endpoints — every
    request is already implicitly Window 6.
    """

    serializer_class = RegistrarQueueRowSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = FormRequestPagination

    def get_queryset(self):
        qs = (
            FormRequest.objects.select_related("transaction_type", "user", "user__user_profile", "submission", "proxy")
            .order_by("-created_at")
        )

        status_param = (self.request.query_params.get("status") or "Submitted").strip()
        if status_param.lower() != "all":
            qs = qs.filter(request_status__iexact=status_param)

        date_from = (self.request.query_params.get("date_from") or "").strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                models.Q(request_code__icontains=search)
                | models.Q(user__first_name__icontains=search)
                | models.Q(user__last_name__icontains=search)
            )

        return qs


class ReleasedPagination(FormRequestPagination):
    """A records page, not a work queue: more rows per page than the six the
    Processing Queue shows, since nobody acts on these one at a time."""

    page_size = 15


def _released_queryset(params):
    """Every released request matching the page's two filters, newest first.

    Shared by the table and the export so "Export to Excel" can never hand
    back a different set of rows than the one on screen - the whole point of
    the button is that it exports what staff are looking at.

    Dates filter on when the document was CLAIMED, not when it was
    requested: this is a record of handovers.
    """
    qs = (
        FormRequest.objects.filter(
            request_status=FormRequest.RequestStatus.RELEASED,
            release_schedule__isnull=False,
        )
        .select_related(
            "transaction_type",
            "user",
            "user__user_profile",
            "submission",
            "proxy",
            "release_schedule",
        )
        .order_by("-release_schedule__claimed_at")
    )

    date_from = (params.get("date_from") or "").strip()
    if date_from:
        qs = qs.filter(release_schedule__claimed_at__date__gte=date_from)
    date_to = (params.get("date_to") or "").strip()
    if date_to:
        qs = qs.filter(release_schedule__claimed_at__date__lte=date_to)

    search = (params.get("search") or "").strip()
    if search:
        qs = qs.filter(
            models.Q(request_code__icontains=search)
            | models.Q(user__first_name__icontains=search)
            | models.Q(user__last_name__icontains=search)
        )
    return qs


class RegistrarReleasedListView(generics.ListAPIView):
    """GET /api/registrar/released/ - the Released Documents table.

    ?date_from=&date_to= (against the claim date) and ?search= (student name
    or request code), paginated.
    """

    serializer_class = RegistrarReleasedRowSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = ReleasedPagination

    def get_queryset(self):
        return _released_queryset(self.request.query_params)


class RegistrarReleasedExportView(APIView):
    """GET /api/registrar/released/export/ - the same rows as an .xlsx file.

    Returns the workbook itself rather than a URL to one: there is no
    generated-files store to put it in, and the record is small enough that
    building it per request costs less than managing stale copies of it.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        rows = list(_released_queryset(request.query_params))
        return build_released_workbook(
            rows,
            date_from=(request.query_params.get("date_from") or "").strip() or None,
            date_to=(request.query_params.get("date_to") or "").strip() or None,
        )


class RegistrarQueueVerifyView(APIView):
    """POST /api/registrar/queue/<id>/verify/ - the Front Desk check.

    Pending Verification -> Verified. This is the first of the two signatures
    the official form carries ("Verified - Name & Signature of Front Desk
    Personnel"): the requirements and clearance are in order, and the request
    is fit to go to the Registrar.

    Deliberately assesses NO fee and stamps NO registrar approval. Those
    belong to the second signature, and a Front Desk verification that also
    priced the request would put one person's name on both lines of a
    document whose whole purpose is to show they were separate decisions.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        form_request = get_object_or_404(FormRequest, pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.SUBMITTED:
            return _wrong_state(form_request, "Pending Verification")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = VerifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        RequirementVerification.objects.create(
            form_request=form_request,
            verification_status=RequirementVerification.VerificationStatus.VERIFIED,
            verified_by=getattr(request.user, "staff_profile", None),
            remarks=serializer.validated_data.get("remarks") or None,
        )
        form_request.request_status = FormRequest.RequestStatus.VERIFIED
        form_request.save(update_fields=["request_status", "updated_at"])

        # No notification here on purpose: verification is an internal
        # handoff between two desks, and there is nothing for the student to
        # do about it. They hear from us when the Registrar approves and
        # there is something to print and pay.
        return Response(RegistrarQueueRowSerializer(form_request).data)


class RegistrarQueueApproveView(APIView):
    """POST /api/registrar/queue/<id>/approve/ - the Registrar sign-off.

    Verified -> Approved - Ready to Print. The second signature on the form
    ("Approved - University Registrar"). This is where the fee is assessed
    and stamped, because pricing is the Registrar's call, and where the
    student first gets something to act on.

    amount_due is written onto the row rather than computed at print time so
    that reprinting a form always reproduces the document the student first
    carried to the Cashier, even if the fee schedule changes afterwards.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        form_request = get_object_or_404(
            FormRequest.objects.select_related("transaction_type", "submission"), pk=pk
        )

        if form_request.request_status != FormRequest.RequestStatus.VERIFIED:
            return _wrong_state(form_request, "Verified")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        staff_profile = getattr(request.user, "staff_profile", None)
        form_request.request_status = FormRequest.RequestStatus.APPROVED
        form_request.registrar_approved_by = staff_profile
        form_request.registrar_approved_at = timezone.now()
        form_request.amount_due = form_request.compute_amount_due()
        form_request.save(
            update_fields=[
                "request_status",
                "registrar_approved_by",
                "registrar_approved_at",
                "amount_due",
                "updated_at",
            ]
        )

        amount = form_request.amount_due
        owed = f"The fee is PHP {amount:,.2f}. " if amount is not None else ""
        _notify_student(
            form_request,
            Notification.NotificationType.APPROVED,
            "Request approved",
            (
                f"{form_request.request_code} has been approved. Download and print your "
                f"request form, then pay at the Cashier. {owed}"
                "Bring the printed form back to Window 6 afterwards."
            ),
        )
        return Response(RegistrarQueueRowSerializer(form_request).data)


class RegistrarQueueRejectView(APIView):
    """POST /api/registrar/queue/<id>/reject/ - turn a request back.

    Allowed from EITHER pre-approval stage. Front Desk rejects what fails the
    requirements check; the Registrar can still refuse something Front Desk
    passed. Refusing from Verified would force the Registrar to approve a
    request they have just decided against.

    Not permitted once approved: by then the student may have paid, and
    unwinding that is a refund conversation, not a status change.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        form_request = get_object_or_404(FormRequest, pk=pk)

        if form_request.request_status not in (
            FormRequest.RequestStatus.SUBMITTED,
            FormRequest.RequestStatus.VERIFIED,
        ):
            return _wrong_state(form_request, "Pending Verification or Verified")

        serializer = RejectRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        staff_profile = getattr(request.user, "staff_profile", None)
        RequirementVerification.objects.create(
            form_request=form_request,
            verification_status=RequirementVerification.VerificationStatus.REJECTED,
            verified_by=staff_profile,
            remarks=serializer.validated_data["remarks"],
        )
        form_request.request_status = FormRequest.RequestStatus.REJECTED
        form_request.save(update_fields=["request_status", "updated_at"])

        _notify_student(
            form_request,
            Notification.NotificationType.REJECTED,
            "Request needs attention",
            (
                f"{form_request.request_code} was not approved. "
                f"Reason: {serializer.validated_data['remarks']}"
            ),
        )

        return Response(RegistrarQueueRowSerializer(form_request).data)


def _student_document_target(request, pk):
    """Resolve a FormRequest for a student-facing PDF, or raise Http404.

    Shared by the receipt and the claim stub so both enforce one rule rather
    than two copies that can drift apart.

    The request's own student, or approved registrar staff. Anyone else gets
    404 rather than 403 - a 403 on a specific id would confirm that request
    exists and let a logged-in student enumerate the request table by walking
    primary keys. Staff are included because they field "I lost my printout"
    at the window and need to reprint.
    """
    form_request = get_object_or_404(
        FormRequest.objects.select_related(
            "user__user_profile",
            "transaction_type",
            "submission",
            "release_slot",
            "release_schedule",
            "registrar_approved_by__user",
        ),
        pk=pk,
    )
    is_owner = form_request.user_id == request.user.id
    if not (is_owner or IsApprovedRegistrarStaff().has_permission(request, None)):
        raise Http404
    return form_request


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


class FormRequestReceiptView(APIView):
    """GET /api/form-requests/<pk>/receipt/ - the printable Cashier form.

    Two independent gates, both enforced here rather than by hiding the
    button. The UI not rendering a link is a convenience, never the control.

    WHO: see _student_document_target.

    WHEN: only while the request sits at Approved - Ready to Print. Before
    that there is no amount due and no approving signatory; after it, payment
    is already logged and a print-and-pay form has nothing left to do.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        form_request = _student_document_target(request, pk)

        if not form_request.receipt_available():
            return Response(
                {
                    "detail": (
                        "This form is not available. It can be printed once the Office of "
                        "the Registrar has approved your request, and stops being available "
                        "once your payment has been logged."
                    ),
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return _pdf_response(
            build_official_form_pdf(form_request), f"TrailSync-{form_request.request_code}.pdf"
        )


class FormRequestClaimStubView(APIView):
    """GET /api/form-requests/<pk>/claim-stub/ - the student's claim stub.

    Gated on digital_stub_active, which Approve & Log switches on the moment
    a Cashier payment is recorded. That flag is the eligibility rule rather
    than a status comparison, so if the stub is ever issued or revoked
    outside the normal Processing transition, this endpoint follows it
    automatically instead of needing its own list of stages kept in step.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        form_request = _student_document_target(request, pk)

        if not form_request.digital_stub_active:
            return Response(
                {
                    "detail": (
                        "Your claim stub is not active yet. It becomes available once "
                        "the Registrar has logged your Cashier payment."
                    ),
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return _pdf_response(
            build_claim_stub_pdf(form_request),
            f"TrailSync-ClaimStub-{form_request.request_code}.pdf",
        )


# ---------------------------------------------------------------------------
# Registrar lifecycle transitions
# ---------------------------------------------------------------------------
#
# One endpoint per transition rather than a writable request_status field.
# Each knows the single stage it may be entered from and refuses anything
# else, so the sequence cannot be skipped or replayed — Release can never
# fire on a request that was never marked Ready, and a double-submitted form
# or a stale browser tab gets a clear conflict instead of quietly moving the
# request a second time.


def _notify_student(form_request, notification_type, title, message):
    """Record an in-app notification for a lifecycle transition.

    Writes a row and nothing more. The brief describes these as triggering
    push via DEVICE_TOKENS; no such table and no push transport exist in this
    project, so rather than imply a delivery that cannot happen, the payload
    such a transport would send is persisted here for one to pick up later.
    """
    return Notification.objects.create(
        user=form_request.user,
        form_request=form_request,
        notification_type=notification_type,
        title=title,
        message=message,
    )


def _wrong_state(form_request, expected_label):
    """409 for a transition attempted from the wrong stage.

    Conflict rather than 400: the payload is fine, the resource simply is not
    in a state where the action means anything. request_status rides along so
    a stale page can resync to the real stage instead of guessing.
    """
    return Response(
        {
            "detail": (
                f"This request has already moved on - it is now at "
                f"\"{form_request.get_request_status_display()}\", so this step no longer applies. "
                f"The page has been refreshed to show what can be done next."
            ),
            "request_status": form_request.request_status,
        },
        status=status.HTTP_409_CONFLICT,
    )


def _blocked_by_clearance_response(form_request):
    """Hard stop for a request whose clearance came back Not Cleared.

    Applies to every transition into Processing or later. A student with an
    outstanding clearance must not reach release no matter which endpoint is
    called or what the UI happens to offer, so the check sits on each
    transition rather than only on the screen that normally precedes it.
    """
    return Response(
        {
            "detail": (
                "This request is blocked: clearance came back Not Cleared. It cannot "
                "move to Processing or beyond until clearance is resolved."
            ),
            "clearance_check_result": form_request.clearance_check_result,
            "request_status": form_request.request_status,
        },
        status=status.HTTP_409_CONFLICT,
    )


def _queue_queryset():
    return FormRequest.objects.select_related(
        "user__user_profile",
        "transaction_type",
        "submission",
        "proxy",
        "release_slot",
        "release_schedule",
        "registrar_approved_by__user",
    )


class RegistrarQueueDetailView(APIView):
    """GET /api/registrar/queue/<id>/ — one request, for the review page.

    The review panel used to read whatever row the list already held in
    memory. A dedicated page is reachable by URL — deep-linked, bookmarked,
    reloaded after an action — so it has to be able to fetch a single request
    on its own without first paging the queue to find it.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request, pk):
        return Response(RegistrarQueueRowSerializer(get_object_or_404(_queue_queryset(), pk=pk)).data)


class RegistrarApproveLogView(APIView):
    """PATCH /api/form-requests/<id>/approve-log/ — log the Cashier payment.

    Approved - Ready to Print -> Processing. The student pays in person, so
    nothing observes that payment as it happens; this is staff attesting
    after the fact to what was hand-written in the printed form's Cashier
    box. or_number and payment_date are captured here and never read back off
    the PDF, which stays a purely printed artefact.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def patch(self, request, pk):
        form_request = get_object_or_404(_queue_queryset(), pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.APPROVED:
            return _wrong_state(form_request, "Approved - Ready to Print")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = ApproveLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        form_request.or_number = serializer.validated_data["or_number"]
        form_request.payment_date = serializer.validated_data["payment_date"]
        form_request.request_status = FormRequest.RequestStatus.PROCESSING

        # The digital claim stub goes live here, not at release. Once the
        # student has paid they are entitled to proof of what they are owed
        # and the right to come and collect it - which is exactly the window
        # in which they need something to show at Window 6. Waiting until
        # release would issue the stub after the only moment it is useful.
        form_request.claim_stub_issued_at = timezone.now()
        form_request.digital_stub_active = True

        form_request.save(
            update_fields=[
                "or_number",
                "payment_date",
                "request_status",
                "claim_stub_issued_at",
                "digital_stub_active",
                "updated_at",
            ]
        )

        _notify_student(
            form_request,
            Notification.NotificationType.PROCESSING,
            "Payment received",
            (
                f"We have logged your payment for {form_request.request_code} "
                f"(O.R. {form_request.or_number}). Your document is now being processed."
            ),
        )
        return Response(RegistrarQueueRowSerializer(form_request).data)


class RegistrarMarkReadyView(APIView):
    """PATCH /api/form-requests/<id>/mark-ready/ - Processing -> Ready for Pickup.

    Staff choose the date. The time is always RELEASE_TIME_START, because
    Window 6 hands documents over between 3:00 and 5:00 PM and nothing else
    was ever on offer - asking for it (and for a capacity slot to hang it on)
    made staff answer a question with one possible answer.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def patch(self, request, pk):
        form_request = get_object_or_404(_queue_queryset(), pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.PROCESSING:
            return _wrong_state(form_request, "Processing")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = MarkReadySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        release_date = serializer.validated_data["release_date"]
        release_time = RELEASE_TIME_START

        schedule, _ = ReleaseSchedule.objects.get_or_create(form_request=form_request)
        schedule.release_date = release_date
        schedule.release_time_start = release_time
        schedule.save(update_fields=["release_date", "release_time_start", "updated_at"])

        form_request.request_status = FormRequest.RequestStatus.READY
        form_request.arrival_notice_sent_at = timezone.now()
        form_request.save(
            update_fields=[
                "request_status",
                "arrival_notice_sent_at",
                "updated_at",
            ]
        )

        when = f" on {release_date:%B %d, %Y}, between {_release_window_text()}"
        _notify_student(
            form_request,
            Notification.NotificationType.READY,
            "Ready for pickup",
            (
                f"Your {form_request.transaction_type.name} ({form_request.request_code}) "
                f"is ready for pickup{when}, Window 6. Bring your claim stub and a valid ID."
            ),
        )

        form_request.refresh_from_db()
        return Response(RegistrarQueueRowSerializer(form_request).data)


class RegistrarReleaseView(APIView):
    """PATCH /api/form-requests/<id>/release/ — Ready for Pickup -> Released.

    Terminal. Records who physically collected the document, which is why
    claimant_name is required rather than assumed to be the student: a proxy
    collection is the entire reason that field is free text.

    When the request names a RequestProxy, proxy_acknowledged must be true —
    staff confirming they checked the notarised authorisation letter and both
    IDs. Enforced here and not only by the checkbox on the page, because the
    checkbox is a prompt and this is the record.

    claimant_signature is deliberately left empty. Capturing a real signature
    needs a canvas flow that is out of scope, and a typed name is an honest
    account of who collected the document where a generated signature image
    would not be.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def patch(self, request, pk):
        form_request = get_object_or_404(_queue_queryset(), pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.READY:
            return _wrong_state(form_request, "Ready for Pickup")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = ReleaseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proxy = getattr(form_request, "proxy", None)
        if proxy is not None and not serializer.validated_data["proxy_acknowledged"]:
            return Response(
                {
                    "detail": (
                        "This request names an authorised proxy. Confirm the notarised "
                        "authorisation letter and both IDs were checked before releasing."
                    ),
                    "proxy_full_name": proxy.proxy_full_name,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        claimant_name = serializer.validated_data["claimant_name"]

        schedule, _ = ReleaseSchedule.objects.get_or_create(form_request=form_request)
        schedule.release_status = "Claimed"
        schedule.claimed_at = now
        schedule.claimant_name = claimant_name
        schedule.save(
            update_fields=["release_status", "claimed_at", "claimant_name", "updated_at"]
        )

        form_request.request_status = FormRequest.RequestStatus.RELEASED
        form_request.save(update_fields=["request_status", "updated_at"])

        _notify_student(
            form_request,
            Notification.NotificationType.RELEASED,
            "Document released",
            (
                f"{form_request.request_code} was released at Window 6 on "
                f"{timezone.localtime(now):%B %d, %Y at %I:%M %p}, claimed by {claimant_name}."
            ),
        )

        form_request.refresh_from_db()
        return Response(RegistrarQueueRowSerializer(form_request).data)


# ---------------------------------------------------------------------------
# Student notifications
# ---------------------------------------------------------------------------
#
# The lifecycle transitions have been writing Notification rows since they
# were built; these are what finally let a student read them. Every query is
# scoped to request.user, so there is no way to address someone else's inbox:
# another user's id simply 404s, which also avoids confirming it exists.


class NotificationPagination(FormRequestPagination):
    page_size = 20


class NotificationListView(generics.ListAPIView):
    """GET /api/notifications/ - the signed-in user's inbox, newest first.

    ?order=oldest flips it, for the full page's sort toggle.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination

    def get_queryset(self):
        order = "created_at" if self.request.query_params.get("order") == "oldest" else "-created_at"
        return (
            Notification.objects.filter(user=self.request.user)
            .select_related("form_request")
            .order_by(order, "-id")
        )


class NotificationUnreadCountView(APIView):
    """GET /api/notifications/unread-count/ - the number on the bell.

    Its own tiny endpoint because every student page asks for it on load;
    fetching a page of full notifications just to count them would be waste.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})


class NotificationMarkReadView(APIView):
    """POST /api/notifications/<id>/read/ - mark one notification read."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(APIView):
    """POST /api/notifications/mark-all-read/ - clear the bell."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        marked = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"marked": marked, "unread_count": 0})


# ---------------------------------------------------------------------------
# Staff fraud alert (duplicate_flag)
# ---------------------------------------------------------------------------
#
# The home for the flag on the registrar side, now that Notifications is a
# student-only page. What SETS the flag is still undecided (see the chat
# note): nothing in the codebase writes it yet. These endpoints make any
# flagged request impossible to miss once something does.


class RegistrarFlaggedRequestsView(APIView):
    """GET /api/registrar/dashboard/flagged/ - requests carrying the fraud flag."""

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        flagged = (
            FormRequest.objects.filter(duplicate_flag=True)
            .select_related("user", "transaction_type")
            .order_by("-updated_at")[:20]
        )
        return Response(
            [
                {
                    "id": fr.id,
                    "request_code": fr.request_code,
                    "student_name": fr.user.get_full_name() or fr.user.email,
                    "transaction_type": fr.transaction_type.name,
                    "request_status": fr.request_status,
                }
                for fr in flagged
            ]
        )


class RegistrarClearFlagView(APIView):
    """POST /api/registrar/queue/<id>/clear-flag/ - staff reviewed it.

    Clearing is deliberately a separate, explicit act rather than something
    that happens as a side effect of opening the request: looking at a fraud
    alert is not the same as having dealt with it.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        form_request = get_object_or_404(FormRequest, pk=pk)
        if form_request.duplicate_flag:
            form_request.duplicate_flag = False
            form_request.save(update_fields=["duplicate_flag", "updated_at"])
        return Response({"id": form_request.id, "duplicate_flag": False})
