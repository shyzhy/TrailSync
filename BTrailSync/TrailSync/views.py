from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import FormRequest, ReleaseSlot, Role, StaffProfile, TransactionType, User
from .serializers import (
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    CreateFormRequestSerializer,
    FormRequestResultSerializer,
    MeSerializer,
    RecentFormRequestSerializer,
    RegisterSerializer,
    ReleaseSlotSerializer,
    TrackedFormRequestSerializer,
    TransactionTypeSerializer,
    UpdateProfileSerializer,
    build_profile_payload,
)


class RegisterView(APIView):
    """POST /api/auth/register/ - student & alumni self-registration."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        # raise_exception=True turns serializer errors into a 400 whose body is
        # {"field": ["message"]}, which is what the React form maps to its
        # per-field inline errors.
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "detail": "Account created successfully.",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role.role_name if user.role_id else None,
                },
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

        profile_data = build_profile_payload(user)

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": role_name,
                    "profile": profile_data,
                },
            },
            status=status.HTTP_200_OK,
        )


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
            request_status__in=[FormRequest.RequestStatus.SUBMITTED, FormRequest.RequestStatus.VERIFIED]
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
        dates = FormRequest.objects.filter(
            user=request.user,
            release_slot__isnull=False,
            release_slot__slot_date__gte=timezone.localdate(),
        ).values_list("release_slot__slot_date", flat=True)

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


class ReleaseSlotListView(generics.ListAPIView):
    """GET /api/release-slots/ - only slots that are actually bookable.

    Fully booked or past-dated slots are simply absent from this list, so
    the frontend never has to reimplement "is this slot pickable" itself —
    whatever comes back is a valid choice.
    """

    serializer_class = ReleaseSlotSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return ReleaseSlot.objects.filter(
            available_slots__gt=0,
            slot_date__gte=timezone.localdate(),
        ).order_by("slot_date", "start_time")


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
            .select_related("transaction_type", "submission", "release_slot", "proxy")
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
