from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import FormRequest, ReleaseSlot, Role, StaffProfile, TransactionType, User
from .serializers import (
    CreateFormRequestSerializer,
    FormRequestResultSerializer,
    MeSerializer,
    RecentFormRequestSerializer,
    RegisterSerializer,
    ReleaseSlotSerializer,
    TransactionTypeSerializer,
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
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


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


class CreateFormRequestView(APIView):
    """POST /api/form-requests/ - submit a new document request.

    request_status, request_code, and the owning user are all set server-side
    (see CreateFormRequestSerializer) — none of them are accepted from the
    client, so a request can't be filed under someone else's account or
    created in a status other than Submitted.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateFormRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        form_request = serializer.save()
        return Response(FormRequestResultSerializer(form_request).data, status=status.HTTP_201_CREATED)
