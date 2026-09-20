import calendar
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import models, transaction
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
from .official_form import archive_official_form, build_official_form_pdf
from .receipts import build_claim_stub_pdf
from .avatars import AvatarRejected, process_avatar
from .models import (
    RELEASE_TIME_END,
    RELEASE_TIME_START,
    FormRequest,
    Notification,
    PaymentProof,
    ReleaseSchedule,
    RequestProxy,
    RequirementVerification,
    Role,
    StaffProfile,
    TransactionType,
    User,
)
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .account_links import (
    account_setup_token,
    activation_token,
    login_audience,
    password_reset_token,
    send_account_setup_email,
    send_activation_email,
    send_password_reset_email,
    user_from_uid,
)
from .serializers import (
    ONBOARDING_STEPS,
    AcceptPaymentProofSerializer,
    ActivateAccountSerializer,
    ApproveLogSerializer,
    ApproveRequestSerializer,
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
    PaymentProofUploadSerializer,
    ProxyAssignmentSerializer,
    RegistrarQueueRowSerializer,
    RegistrarRecentSubmissionSerializer,
    RegistrarReleasedRowSerializer,
    RegistrarTodaysPickupRowSerializer,
    RejectPaymentProofSerializer,
    RejectRequestSerializer,
    ReleaseRequestSerializer,
    TrackedFormRequestSerializer,
    TransactionTypeSerializer,
    UpdateProfileSerializer,
    VerifyRequestSerializer,
    build_profile_payload,
    proxy_version,
)


class IsApprovedRegistrarStaff(BasePermission):
    """Gate for every registrar endpoint: Registrar Staff role and an approved staff profile, checked on every call."""

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
    """POST /api/auth/register/ - create an account and email a confirmation link. Throttled; returns no tokens."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        # Serializer errors become {"field": ["message"]}, which the React forms map to inline errors.
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

        # Right password but unconfirmed address; staff accounts are provisioned by an admin, not confirmed by email.
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
    """Tokens plus the user, in the shape the frontend saves as a session (shared by login and activation)."""
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
    """POST /api/auth/activate/ {uid, token} - confirm the address and sign in. Errors carry a code: already_active, expired or invalid."""

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
            # Checked before the token, because activation flips the flag the token is signed over.
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
    """POST /api/auth/resend-activation/ {email} - send a fresh link. Always answers the same, and throttled."""

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
            # Background, so the answer takes the same time whether or not the account exists.
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
    """POST /api/auth/password-reset/ {email} - email a reset link if the account exists; identical answer and timing either way."""

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
        elif user is not None and hasattr(user, "staff_profile"):
            # A staff member who never finished setup gets a fresh setup link instead.
            send_account_setup_email(user, background=True)
        return Response({"detail": PASSWORD_RESET_SENT})


RESET_LINK_DEAD = "This reset link has expired or already been used."
SETUP_LINK_DEAD = "This setup link has expired or already been used."


def _reset_link_user(serializer, generator=password_reset_token, dead_message=RESET_LINK_DEAD):
    """(user, None) for a usable emailed link, or (None, error Response); expired and used links are reported the same."""
    user = user_from_uid(serializer.validated_data["uid"])
    result = generator.verify(user, serializer.validated_data["token"]) if user else "invalid"
    if result != "ok":
        return None, Response({"code": result, "detail": dead_message}, status=status.HTTP_400_BAD_REQUEST)
    return user, None


def _set_password_from_link(user, data):
    """Validate and save a password chosen through an emailed link; returns an error Response or None."""
    if data["new_password"] != data["confirm_new_password"]:
        return Response({"confirm_new_password": ["Passwords don't match."]}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(data["new_password"], user)
    except DjangoValidationError as exc:
        return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(data["new_password"])
    fields = ["password"]
    # Opening this link proves the inbox, so an unconfirmed account is confirmed too.
    if not user.email_verified:
        user.email_verified = True
        user.email_verified_at = timezone.now()
        fields += ["email_verified", "email_verified_at"]
    user.save(update_fields=fields)
    return None


class PasswordResetValidateView(APIView):
    """POST /api/auth/password-reset/validate/ {uid, token} - is this link still good?"""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"code": "invalid", "detail": RESET_LINK_DEAD}, status=status.HTTP_400_BAD_REQUEST)
        _, error = _reset_link_user(serializer)
        return error or Response({"valid": True})


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm/ - set the new password. Deliberately does not sign the person in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, error = _reset_link_user(serializer)
        if error:
            return error

        error = _set_password_from_link(user, serializer.validated_data)
        if error:
            return error
        return Response({"detail": "Your password has been changed.", "login": login_audience(user)})


class AccountSetupValidateView(APIView):
    """POST /api/auth/account-setup/validate/ {uid, token} - is this setup link still good, and whose is it?"""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "account_setup"

    def post(self, request):
        serializer = PasswordResetLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"code": "invalid", "detail": SETUP_LINK_DEAD}, status=status.HTTP_400_BAD_REQUEST)
        user, error = _reset_link_user(serializer, account_setup_token, SETUP_LINK_DEAD)
        if error:
            return error
        return Response({"valid": True, "email": user.email, "first_name": user.first_name})


class AccountSetupConfirmView(APIView):
    """POST /api/auth/account-setup/confirm/ - choose the first password for an admin-created account."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "account_setup"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, error = _reset_link_user(serializer, account_setup_token, SETUP_LINK_DEAD)
        if error:
            return error
        error = _set_password_from_link(user, serializer.validated_data)
        if error:
            return error
        return Response({"detail": "Your account is ready.", "login": login_audience(user)})


# What a filed request was made under; the last semester attended and graduation date stay editable.
LOCKED_ACADEMIC_FIELDS = ("school_id_number", "course", "academic_status")


def _comparable(field, value):
    """A locked field's value as compared for changes: case-blind text, or the set of ticked statuses."""
    if field == "academic_status":
        return frozenset(value or ())
    return str(value or "").strip().lower()


class MeOnboardingView(APIView):
    """PATCH /api/me/onboarding/ {step, ...fields} - save one wizard step; academic records lock once a request exists."""

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

        # The lock is on changing a record a request was filed under, not on filling a blank.
        if step == "academic" and request.user.form_requests.exists():
            changed = [
                field
                for field in LOCKED_ACADEMIC_FIELDS
                if getattr(profile, field)
                and _comparable(field, serializer.validated_data.get(field))
                != _comparable(field, getattr(profile, field))
            ]
            if changed:
                return Response(
                    {
                        "detail": (
                            "Your School ID number, course and academic status are already on file with "
                            "a request. To change them, please ask at Window 6."
                        ),
                        "locked_fields": changed,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer.save(request.user)
        return Response(MeSerializer(request.user).data)


class MeView(APIView):
    """GET /api/me/ - who the token belongs to. PATCH - the Profile page's editable fields."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class MeAvatarView(APIView):
    """PATCH /api/me/avatar/ - set the profile picture (re-validated server-side). DELETE - remove it. Students and alumni only."""

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

        # Write the new file before removing the old one, so a failure leaves the photo they had.
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
            # Remove the file, then clear the column so the row never points at a missing file.
            profile.profile_picture.delete(save=False)
        profile.profile_picture = None
        profile.save(update_fields=["profile_picture", "updated_at"])
        return Response(MeSerializer(request.user).data)


class MeTourView(APIView):
    """POST /api/me/tour/ - the walkthrough was finished or skipped. Idempotent."""

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
    """POST /api/me/change-password/ - the Profile page's Change Password card."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Your password has been updated."})


class ChangeEmailRequestView(APIView):
    """POST /api/me/change-email/request/ - mail a confirmation link to the new address; nothing changes yet."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangeEmailRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data["new_email"]

        signer = TimestampSigner()
        token = signer.sign_object({"user_id": request.user.id, "new_email": new_email})
        # Points at the React app, which reads ?token= and POSTs it to change-email/confirm/.
        verify_url = f"{settings.FRONTEND_BASE_URL}/confirm-email?token={token}"

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
    """POST /api/me/change-email/confirm/ - apply the change, after re-checking the address is still free."""

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
    """GET /api/dashboard/summary/ - the student home-screen counts, always for request.user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = FormRequest.objects.filter(user=request.user)
        current_year = timezone.now().year

        active_requests_count = base.filter(
            request_status__in=[
                FormRequest.RequestStatus.SUBMITTED,
                FormRequest.RequestStatus.VERIFIED,
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
        # select_related avoids an N+1 for transaction_type.name.
        return (
            FormRequest.objects.filter(user=self.request.user)
            .select_related("transaction_type")
            .order_by("-created_at")[:5]
        )


class UpcomingReleaseDatesView(APIView):
    """GET /api/dashboard/upcoming-release-dates/ - deduped ISO dates of the student's upcoming handovers."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Reads the schedule, which is what Mark Ready to Release writes.
        dates = FormRequest.objects.filter(
            user=request.user,
            release_schedule__release_date__gte=timezone.localdate(),
        ).values_list("release_schedule__release_date", flat=True)

        # Deduped in Python: .distinct() would also compare on the default ordering's created_at.
        unique_dates = sorted(set(dates))
        return Response({"dates": [d.isoformat() for d in unique_dates]})


class TransactionTypeListView(generics.ListAPIView):
    """GET /api/transaction-types/ - the requestable documents."""

    serializer_class = TransactionTypeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = TransactionType.objects.all().order_by("name")


class FormRequestPagination(PageNumberPagination):
    """Reports the page's start/end index so the client never recomputes offsets."""

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
    """GET /api/form-requests/ - the student's own requests, filterable and paginated. POST - submit a request; status, code and owner are set server-side."""

    permission_classes = [IsAuthenticated]
    pagination_class = FormRequestPagination

    def get_serializer_class(self):
        return CreateFormRequestSerializer if self.request.method == "POST" else TrackedFormRequestSerializer

    def get_queryset(self):
        qs = (
            FormRequest.objects.filter(user=self.request.user)
            .select_related("transaction_type", "submission", "release_slot", "proxy", "release_schedule")
            .prefetch_related("payment_proofs")
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
    """Requests whose handover falls in [first_day, last_day]: the schedule date, or a legacy slot date when there is none."""
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
    """"3:00 PM to 5:00 PM", built without strftime's %-I, which raises on Windows."""
    fmt = lambda t: f"{t:%I:%M %p}".lstrip("0")  # noqa: E731
    return f"{fmt(RELEASE_TIME_START)} and {fmt(RELEASE_TIME_END)}"


class RegistrarDashboardSummaryView(APIView):
    """GET /api/registrar/dashboard/summary/ - the four stat cards. Not scoped by window, since there is only Window 6."""

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())  # Monday

        pending_review_count = FormRequest.objects.filter(
            request_status=FormRequest.RequestStatus.SUBMITTED
        ).count()

        # Counts verification events that actually happened today.
        verified_today_count = RequirementVerification.objects.filter(
            verification_status=RequirementVerification.VerificationStatus.VERIFIED,
            verified_at__date=today,
        ).count()

        # Scheduled for handover today.
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
    """GET /api/registrar/dashboard/recent-submissions/ - the latest 5 requests."""

    serializer_class = RegistrarRecentSubmissionSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        return (
            FormRequest.objects.select_related("transaction_type", "user")
            .order_by("-created_at")[:5]
        )


class RegistrarTodaysPickupsView(generics.ListAPIView):
    """GET /api/registrar/dashboard/todays-pickups/ - requests scheduled for handover today."""

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
    """GET /api/registrar/release-calendar/?year=&month= - dates and counts only. Read-only."""

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
    """GET /api/registrar/release-calendar/day/?date=YYYY-MM-DD - who is due that day, and whether it was collected."""

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
                    "proxy_changed_at": fr.proxy_changed_at.isoformat() if fr.proxy_changed_at else None,
                }
            )
        rows.sort(key=lambda r: (r["release_time_start"] or "", r["request_code"]))
        return Response({"date": day.isoformat(), "releases": rows})


class RegistrarQueueListView(generics.ListAPIView):
    """GET /api/registrar/queue/ - the Processing Queue, filterable by status, dates and search."""

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
    """A records page rather than a work queue, so more rows per page."""

    page_size = 15


def _released_queryset(params):
    """Released requests matching the page's filters, shared by the table and the export; dates filter on the claim date."""
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
    """GET /api/registrar/released/ - the Released Documents table."""

    serializer_class = RegistrarReleasedRowSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = ReleasedPagination

    def get_queryset(self):
        return _released_queryset(self.request.query_params)


class RegistrarReleasedExportView(APIView):
    """GET /api/registrar/released/export/ - the same rows as an .xlsx file."""

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        rows = list(_released_queryset(request.query_params))
        return build_released_workbook(
            rows,
            date_from=(request.query_params.get("date_from") or "").strip() or None,
            date_to=(request.query_params.get("date_to") or "").strip() or None,
        )


class RegistrarQueueVerifyView(APIView):
    """POST /api/registrar/queue/<id>/verify/ - Front Desk check (Submitted -> Verified). No fee and no Registrar approval here."""

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def post(self, request, pk):
        _lock_request(pk)
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

        # No notification: verification is an internal handoff, and the student has nothing to do yet.
        return Response(RegistrarQueueRowSerializer(form_request).data)


class RegistrarQueueApproveView(APIView):
    """POST /api/registrar/queue/<id>/approve/ - Registrar sign-off (Verified -> Approved), recording the page count.

    No price is stored here: until the payment is logged the amount follows the current fee (see current_amount_due).
    """

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def post(self, request, pk):
        _lock_request(pk)
        form_request = get_object_or_404(
            FormRequest.objects.select_related("transaction_type", "submission"), pk=pk
        )

        if form_request.request_status != FormRequest.RequestStatus.VERIFIED:
            return _wrong_state(form_request, "Verified")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = ApproveRequestSerializer(
            data=request.data, context={"transaction_type": form_request.transaction_type}
        )
        serializer.is_valid(raise_exception=True)

        staff_profile = getattr(request.user, "staff_profile", None)
        form_request.request_status = FormRequest.RequestStatus.APPROVED
        form_request.registrar_approved_by = staff_profile
        form_request.registrar_approved_at = timezone.now()
        # The page count is known only now, when the Registrar has pulled the record; the price is locked later, at payment.
        form_request.page_count = serializer.validated_data["page_count"]
        form_request.save(
            update_fields=[
                "request_status",
                "registrar_approved_by",
                "registrar_approved_at",
                "page_count",
                "updated_at",
            ]
        )

        # Said as today's price: the notification is kept, but the fee can still change before they pay.
        amount = form_request.current_amount_due()
        owed = f"At the current fee this comes to PHP {amount:,.2f}. " if amount is not None else ""
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
    """POST /api/registrar/queue/<id>/reject/ - allowed from either pre-approval stage, never after approval."""

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def post(self, request, pk):
        _lock_request(pk)
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


def _document_queryset():
    """Everything the PDFs print, fetched in one query."""
    return FormRequest.objects.select_related(
        "user__user_profile",
        "transaction_type",
        "submission",
        "release_slot",
        "release_schedule",
        "registrar_approved_by__user",
    )


def _student_document_target(request, pk):
    """The FormRequest for a student-facing PDF: its own student or approved staff; anyone else gets 404, not 403."""
    form_request = get_object_or_404(_document_queryset(), pk=pk)
    is_owner = form_request.user_id == request.user.id
    if not (is_owner or IsApprovedRegistrarStaff().has_permission(request, None)):
        raise Http404
    return form_request


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    # The amount on an unpaid form follows the current fee, so a stored copy could print yesterday's price.
    response["Cache-Control"] = "no-store"
    return response


class FormRequestReceiptView(APIView):
    """GET /api/form-requests/<pk>/receipt/ - the official form, from Approved - Ready to Print on.

    Drawn fresh on every download. The amount is today's price until payment is logged and the locked one after; Part
    2's price list is always today's fees. Nothing is saved here (the payment-time record is written at Approve & Log).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        form_request = _student_document_target(request, pk)

        if not form_request.receipt_available():
            return Response(
                {
                    "detail": (
                        "This form is not available yet. It can be printed once the Office of "
                        "the Registrar has approved your request."
                    ),
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return _pdf_response(
            build_official_form_pdf(form_request), f"TrailSync-{form_request.request_code}.pdf"
        )


class FormRequestClaimStubView(APIView):
    """GET /api/form-requests/<pk>/claim-stub/ - the claim stub, gated on digital_stub_active."""

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


def _own_request(request, pk):
    """The student's own request for an action on it; anyone else's is a 404, as if it didn't exist."""
    return get_object_or_404(
        FormRequest.objects.select_related("transaction_type", "submission", "release_slot", "proxy", "release_schedule")
        .prefetch_related("payment_proofs"),
        pk=pk,
        user=request.user,
    )


class FormRequestPaymentProofView(APIView):
    """POST /api/form-requests/<id>/payment-proof/ - the student's own proof of having paid at the Cashier.

    A second way to reach the same place as Window 6's Approve & Log, not a replacement: staff can still log a payment
    from the printed receipt whatever is uploaded here. Nothing moves until the Registrar accepts the upload.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        # Locked so this can't cross with staff logging the payment at the window at the same moment.
        _lock_request(pk)
        form_request = _own_request(request, pk)

        if form_request.price_locked():
            return Response(
                {
                    "detail": (
                        "Your payment is already logged for this request, so there is nothing to upload. "
                        "Check Track Requests for where it is now."
                    ),
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_409_CONFLICT,
            )
        if form_request.request_status != FormRequest.RequestStatus.APPROVED:
            return _wrong_state(form_request, "Approved - Ready to Print")
        if not form_request.can_upload_payment_proof():
            return Response(
                {
                    "detail": (
                        "Your last upload is still being reviewed. We'll let you know as soon as it has been checked."
                    ),
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PaymentProofUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proof = PaymentProof.objects.create(
            form_request=form_request,
            receipt_image_path=serializer.validated_data["receipt_image"],
            student_entered_or_number=serializer.validated_data["student_entered_or_number"],
        )

        _notify_student(
            form_request,
            Notification.NotificationType.PAYMENT_PROOF,
            "Payment proof submitted",
            (
                f"We received your receipt for {form_request.request_code} (O.R. {proof.student_entered_or_number}). "
                "We'll review it and let you know once your payment is confirmed."
            ),
        )
        form_request.refresh_from_db()
        return Response(TrackedFormRequestSerializer(form_request).data, status=status.HTTP_201_CREATED)


class FormRequestCancelView(APIView):
    """POST /api/form-requests/<id>/cancel/ - the student ends their own request, only before payment is logged.

    The status is re-checked under a row lock at the moment of the request, not trusted from the page: the Registrar may
    have logged the payment since the Cancel button was drawn.
    """

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        _lock_request(pk)
        form_request = _own_request(request, pk)

        if not form_request.can_cancel():
            if form_request.request_status == FormRequest.RequestStatus.CANCELLED:
                detail = "This request is already cancelled."
            elif form_request.request_status in (FormRequest.RequestStatus.REJECTED, FormRequest.RequestStatus.RELEASED):
                detail = "This request is already closed, so there is nothing to cancel."
            else:
                detail = (
                    "This request can no longer be cancelled: your payment has been logged. "
                    "If you need to stop it, please talk to Window 6."
                )
            return Response(
                {"detail": detail, "request_status": form_request.request_status}, status=status.HTTP_409_CONFLICT
            )

        form_request.request_status = FormRequest.RequestStatus.CANCELLED
        form_request.cancelled_at = timezone.now()
        form_request.save(update_fields=["request_status", "cancelled_at", "updated_at"])
        # Nothing left to review on a request its own student has ended.
        _close_pending_proofs(form_request)

        _notify_student(
            form_request,
            Notification.NotificationType.CANCELLED,
            "Request cancelled",
            (
                f"You cancelled {form_request.request_code} ({form_request.transaction_type.name}). "
                "Nothing more will happen with it. If you still need the document, send a new request."
            ),
        )
        return Response(TrackedFormRequestSerializer(form_request).data)


class FormRequestProxyView(APIView):
    """PUT /api/form-requests/<id>/proxy/ - add or change who collects the document, only at Ready for Pickup.

    The status is checked under the row lock, like cancelling. proxy_changed_at is what tells Window 6 about the late
    change: the queue, calendar and review page flag it, and Release refuses a screen showing the old proxy.
    """

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def put(self, request, pk):
        _lock_request(pk)
        form_request = _own_request(request, pk)

        if not form_request.can_change_proxy():
            if form_request.request_status == FormRequest.RequestStatus.RELEASED:
                detail = "This document has already been collected, so the proxy can't be changed."
            elif form_request.request_status in (FormRequest.RequestStatus.CANCELLED, FormRequest.RequestStatus.REJECTED):
                detail = "This request is closed, so there is no one to collect it."
            else:
                detail = "You can name someone to collect this once it's ready for pickup."
            return Response(
                {"detail": detail, "request_status": form_request.request_status}, status=status.HTTP_409_CONFLICT
            )

        serializer = ProxyAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        RequestProxy.objects.update_or_create(form_request=form_request, defaults=serializer.validated_data)

        form_request.proxy_changed_at = timezone.now()
        form_request.save(update_fields=["proxy_changed_at", "updated_at"])

        form_request = _own_request(request, pk)
        return Response(TrackedFormRequestSerializer(form_request).data)


# Registrar lifecycle transitions: one endpoint per move, each refusing anything but its entry stage, so the sequence can't be skipped or replayed.


def _lock_request(pk):
    """Row-lock one request for the current transaction; the caller then reads it fresh. Callers must be atomic.

    Every action that moves a request out of a stage the student can also act on takes this lock, so a cancel and an
    Approve & Log (or a proxy change and a release) can't both succeed on the same starting state.
    """
    list(FormRequest.objects.select_for_update().filter(pk=pk).values_list("pk", flat=True))


def _notify_student(form_request, notification_type, title, message):
    """Record an in-app notification for a lifecycle transition."""
    return Notification.objects.create(
        user=form_request.user,
        form_request=form_request,
        notification_type=notification_type,
        title=title,
        message=message,
    )


def _wrong_state(form_request, expected_label):
    """409 for a transition attempted from the wrong stage, with the real request_status so the page can resync."""
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
    """Hard stop for a Not Cleared request on every transition into Processing or later."""
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


def _archive_official_form(pk):
    archive_official_form(_document_queryset().get(pk=pk))


def _log_payment(form_request, validated, *, keep_proof=None):
    """Record a Cashier payment: lock the amount, move to Processing and open the claim stub.

    Both routes end here: the Registrar typing a printed receipt in at Window 6, and the Registrar accepting a payment
    proof the student uploaded. Returns a 409 Response if the fee moved since the page was drawn, otherwise None.
    """
    # The price is locked now, from the fee at this moment, and never worked out again.
    amount = form_request.calculate_amount_due()
    # Never lock a number the Registrar didn't see: if the fee moved while the page was open, show them the new one first.
    if "expected_amount_due" in validated and validated["expected_amount_due"] != amount:
        shown = validated["expected_amount_due"]
        return Response(
            {
                "detail": (
                    f"The fee for {form_request.transaction_type.name} changed while this page was open: this "
                    f"request now comes to {_peso(amount)}, not {_peso(shown)}. The page has been refreshed. "
                    "Check the new amount, then save the payment again."
                ),
                "request_status": form_request.request_status,
            },
            status=status.HTTP_409_CONFLICT,
        )

    form_request.amount_due = amount
    form_request.or_number = validated["or_number"]
    form_request.payment_date = validated["payment_date"]
    form_request.request_status = FormRequest.RequestStatus.PROCESSING

    # The digital claim stub goes live at payment, the window in which the student needs it.
    form_request.claim_stub_issued_at = timezone.now()
    form_request.digital_stub_active = True
    # Keep the official form as it stands at payment, once the payment is committed. It is a record, not what
    # downloads serve; if writing it fails, that is logged rather than undoing the payment.
    transaction.on_commit(lambda: _archive_official_form(form_request.pk), robust=True)

    form_request.save(
        update_fields=[
            "amount_due",
            "or_number",
            "payment_date",
            "request_status",
            "claim_stub_issued_at",
            "digital_stub_active",
            "updated_at",
        ]
    )
    _close_pending_proofs(form_request, keep=keep_proof)
    return None


def _close_pending_proofs(form_request, keep=None):
    """An upload still waiting has nothing left to review once the payment is recorded, so it stops sitting in the queue."""
    waiting = form_request.payment_proofs.filter(verification_status=PaymentProof.VerificationStatus.PENDING)
    if keep is not None:
        waiting = waiting.exclude(pk=keep.pk)
    waiting.update(verification_status=PaymentProof.VerificationStatus.SUPERSEDED, reviewed_at=timezone.now())


def _peso(amount):
    return "no set fee" if amount is None else f"PHP {amount:,.2f}"


def _queue_queryset():
    return FormRequest.objects.select_related(
        "user__user_profile",
        "transaction_type",
        "submission",
        "proxy",
        "release_slot",
        "release_schedule",
        "registrar_approved_by__user",
    ).prefetch_related("payment_proofs__reviewed_by__user")


class RegistrarQueueDetailView(APIView):
    """GET /api/registrar/queue/<id>/ - one request, for the review page."""

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request, pk):
        return Response(RegistrarQueueRowSerializer(get_object_or_404(_queue_queryset(), pk=pk)).data)


class RegistrarApproveLogView(APIView):
    """PATCH /api/form-requests/<id>/approve-log/ - log the Cashier payment (Approved -> Processing), locking the price."""

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def patch(self, request, pk):
        # Locked so this can't cross with the student cancelling at the same moment.
        _lock_request(pk)
        form_request = get_object_or_404(_queue_queryset(), pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.APPROVED:
            return _wrong_state(form_request, "Approved - Ready to Print")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = ApproveLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conflict = _log_payment(form_request, serializer.validated_data)
        if conflict is not None:
            return conflict

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


def _proof_for_review(pk):
    """The upload, its request locked and read fresh, or the 409 that says there is nothing to review on it."""
    proof = get_object_or_404(PaymentProof.objects.select_related("form_request"), pk=pk)
    _lock_request(proof.form_request_id)
    proof.refresh_from_db()
    form_request = get_object_or_404(_queue_queryset(), pk=proof.form_request_id)

    if proof.verification_status != PaymentProof.VerificationStatus.PENDING:
        detail = {
            PaymentProof.VerificationStatus.ACCEPTED: "This payment proof has already been accepted.",
            PaymentProof.VerificationStatus.REJECTED: "This payment proof has already been turned down.",
            PaymentProof.VerificationStatus.SUPERSEDED: (
                "This payment proof is no longer waiting: the payment for this request was logged another way."
            ),
        }[proof.verification_status]
        return proof, form_request, Response(
            {"detail": f"{detail} The page has been refreshed.", "request_status": form_request.request_status},
            status=status.HTTP_409_CONFLICT,
        )
    if form_request.request_status != FormRequest.RequestStatus.APPROVED:
        return proof, form_request, _wrong_state(form_request, "Approved - Ready to Print")
    if form_request.blocked_by_clearance():
        return proof, form_request, _blocked_by_clearance_response(form_request)
    return proof, form_request, None


class RegistrarPaymentProofAcceptView(APIView):
    """POST /api/registrar/payment-proofs/<id>/accept/ - confirm an uploaded receipt, with the same effect as Approve & Log.

    The O.R. number and date are the staff member's to confirm or correct against the photo, not taken as the student typed them.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def post(self, request, pk):
        proof, form_request, refusal = _proof_for_review(pk)
        if refusal is not None:
            return refusal

        serializer = AcceptPaymentProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        conflict = _log_payment(form_request, serializer.validated_data, keep_proof=proof)
        if conflict is not None:
            return conflict

        proof.verification_status = PaymentProof.VerificationStatus.ACCEPTED
        proof.reviewed_by = getattr(request.user, "staff_profile", None)
        proof.reviewed_at = timezone.now()
        proof.save(update_fields=["verification_status", "reviewed_by", "reviewed_at"])

        _notify_student(
            form_request,
            Notification.NotificationType.PROCESSING,
            "Payment confirmed",
            (
                f"We checked your receipt for {form_request.request_code} and confirmed your payment "
                f"(O.R. {form_request.or_number}). Your document is now being processed."
            ),
        )
        return Response(RegistrarQueueRowSerializer(_queue_queryset().get(pk=form_request.pk)).data)


class RegistrarPaymentProofRejectView(APIView):
    """POST /api/registrar/payment-proofs/<id>/reject/ - turn down an uploaded receipt, with a reason the student can act on.

    The request stays at Approved - Ready to Print: the student can upload a clearer photo or bring the receipt in.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def post(self, request, pk):
        proof, form_request, refusal = _proof_for_review(pk)
        if refusal is not None:
            return refusal

        serializer = RejectPaymentProofSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proof.verification_status = PaymentProof.VerificationStatus.REJECTED
        proof.rejection_reason = serializer.validated_data["rejection_reason"]
        proof.reviewed_by = getattr(request.user, "staff_profile", None)
        proof.reviewed_at = timezone.now()
        proof.save(update_fields=["verification_status", "rejection_reason", "reviewed_by", "reviewed_at"])

        _notify_student(
            form_request,
            Notification.NotificationType.PAYMENT_PROOF,
            "Payment proof needs another look",
            (
                f"We couldn't confirm your payment for {form_request.request_code}. {proof.rejection_reason} "
                "You can upload a clearer photo, or bring your printed receipt to Window 6 instead."
            ),
        )
        return Response(RegistrarQueueRowSerializer(_queue_queryset().get(pk=form_request.pk)).data)


class RegistrarMarkReadyView(APIView):
    """PATCH /api/form-requests/<id>/mark-ready/ - Processing -> Ready for Pickup; staff choose only the date."""

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
    """PATCH /api/form-requests/<id>/release/ - Ready for Pickup -> Released, recording who collected it."""

    permission_classes = [IsApprovedRegistrarStaff]

    @transaction.atomic
    def patch(self, request, pk):
        # Locked so a proxy change from the student lands either before this release or not at all.
        _lock_request(pk)
        form_request = get_object_or_404(_queue_queryset(), pk=pk)

        if form_request.request_status != FormRequest.RequestStatus.READY:
            return _wrong_state(form_request, "Ready for Pickup")
        if form_request.blocked_by_clearance():
            return _blocked_by_clearance_response(form_request)

        serializer = ReleaseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # The screen must be showing the current proxy: releasing to the person the student has just replaced is the risk.
        seen = serializer.validated_data.get("proxy_version")
        if seen and seen != proxy_version(form_request):
            proxy = getattr(form_request, "proxy", None)
            return Response(
                {
                    "detail": (
                        "The student changed who will collect this document while this page was open. "
                        "The page has been refreshed: check the new details before releasing."
                    ),
                    "proxy_full_name": proxy.proxy_full_name if proxy else None,
                    "request_status": form_request.request_status,
                },
                status=status.HTTP_409_CONFLICT,
            )

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


# Student notifications: every query is scoped to request.user, so another inbox simply 404s.


class NotificationPagination(FormRequestPagination):
    page_size = 20


class NotificationListView(generics.ListAPIView):
    """GET /api/notifications/ - the user's inbox, newest first (?order=oldest flips it)."""

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
    """GET /api/notifications/unread-count/ - the number on the bell."""

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


# Staff fraud alert (duplicate_flag). Nothing sets the flag yet; these make a flagged request impossible to miss.


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
    """POST /api/registrar/queue/<id>/clear-flag/ - staff reviewed it; opening a request never clears the flag."""

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        form_request = get_object_or_404(FormRequest, pk=pk)
        if form_request.duplicate_flag:
            form_request.duplicate_flag = False
            form_request.save(update_fields=["duplicate_flag", "updated_at"])
        return Response({"id": form_request.id, "duplicate_flag": False})
