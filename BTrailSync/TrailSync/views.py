from datetime import timedelta

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
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .official_form import build_official_form_pdf
from .receipts import build_claim_stub_pdf
from .models import (
    FormRequest,
    Notification,
    ReleaseSchedule,
    ReleaseSlot,
    RequirementVerification,
    Role,
    StaffProfile,
    TransactionType,
    User,
)
from .serializers import (
    ApproveLogSerializer,
    AssignSlotSerializer,
    AssignableRequestSerializer,
    ChangeEmailConfirmSerializer,
    ChangeEmailRequestSerializer,
    ChangePasswordSerializer,
    CreateFormRequestSerializer,
    CreateReleaseSlotSerializer,
    FormRequestResultSerializer,
    MarkReadySerializer,
    MeSerializer,
    RecentFormRequestSerializer,
    RegisterSerializer,
    RegistrarQueueRowSerializer,
    RegistrarRecentSubmissionSerializer,
    RegistrarReleaseSlotRowSerializer,
    RejectRequestSerializer,
    ReleaseRequestSerializer,
    ReleaseSlotDetailSerializer,
    ReleaseSlotSerializer,
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

        # "For release today" = booked into a slot dated today, not a
        # RELEASE_SCHEDULES query — that table only records the claim event
        # after the fact, it has no date/status of its own to query against.
        for_release_today_count = FormRequest.objects.filter(release_slot__slot_date=today).count()

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


class RegistrarTodaysReleaseSlotsView(generics.ListAPIView):
    """GET /api/registrar/dashboard/todays-release-slots/ - requests booked
    into a ReleaseSlot dated today, for the Dashboard's "Today's Release
    Slots" card."""

    serializer_class = RegistrarReleaseSlotRowSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        today = timezone.localdate()
        return (
            FormRequest.objects.filter(release_slot__slot_date=today)
            .select_related("transaction_type", "user", "release_slot")
            .order_by("release_slot__start_time")
        )


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


class RegistrarReleaseSlotCalendarView(APIView):
    """GET /api/registrar/release-slots/calendar/?year=&month= - lightweight
    dates+counts for the visible month, so the calendar doesn't have to pull
    full slot detail (assignments, etc.) just to draw dots."""

    permission_classes = [IsApprovedRegistrarStaff]

    def get(self, request):
        try:
            year = int(request.query_params.get("year"))
            month = int(request.query_params.get("month"))
        except (TypeError, ValueError):
            return Response({"detail": "year and month query params are required."}, status=status.HTTP_400_BAD_REQUEST)

        rows = (
            ReleaseSlot.objects.filter(slot_date__year=year, slot_date__month=month)
            .values("slot_date")
            .annotate(slot_count=models.Count("id"))
            .order_by("slot_date")
        )
        return Response([{"date": r["slot_date"].isoformat(), "slot_count": r["slot_count"]} for r in rows])


class RegistrarReleaseSlotsForDateView(generics.ListAPIView):
    """GET /api/registrar/release-slots/?date=YYYY-MM-DD - full detail
    (including assigned students) for one date only."""

    serializer_class = ReleaseSlotDetailSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        date_param = (self.request.query_params.get("date") or "").strip()
        qs = ReleaseSlot.objects.all()
        if date_param:
            qs = qs.filter(slot_date=date_param)
        return qs.order_by("start_time")


class RegistrarCreateReleaseSlotView(generics.CreateAPIView):
    """POST /api/registrar/release-slots/ - "+ Create New Slot" (any date)
    and "+ Add Time Slot" (pre-filled date) both post here; the only
    difference is what date the frontend pre-fills in the form."""

    serializer_class = CreateReleaseSlotSerializer
    permission_classes = [IsApprovedRegistrarStaff]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot = serializer.save()
        return Response(ReleaseSlotDetailSerializer(slot).data, status=status.HTTP_201_CREATED)


class RegistrarAssignableRequestsView(generics.ListAPIView):
    """GET /api/registrar/release-slots/assignable-requests/ - the Assign
    picker's options: every Ready-status request, whichever slot (if any)
    it's currently attached to. Not restricted to "not yet in a slot" —
    picking an already-assigned one from a different slot's Assign button
    is how reassignment works, since students currently have no path of
    their own to pick a slot (that step was dropped from the Request Form
    wizard), so every assignment today originates from this endpoint or an
    earlier one via this same flow.
    """

    serializer_class = AssignableRequestSerializer
    permission_classes = [IsApprovedRegistrarStaff]
    pagination_class = None

    def get_queryset(self):
        return (
            FormRequest.objects.filter(
                request_status__in=[
                    FormRequest.RequestStatus.PROCESSING,
                    FormRequest.RequestStatus.READY,
                ]
            )
            .select_related("transaction_type", "user")
            .order_by("-created_at")
        )


class RegistrarAssignSlotView(APIView):
    """POST /api/registrar/release-slots/<slot_id>/assign/ {form_request} -
    points a FormRequest at this ReleaseSlot. No ReleaseSchedule row is
    created here - that model records the actual claim event, which has not
    happened yet; the row is created by RegistrarReleaseView when the
    document is physically handed over. A request with a slot but no
    schedule row therefore reads as Scheduled, and one whose schedule says
    release_status="Claimed" reads as Claimed.
    """

    permission_classes = [IsApprovedRegistrarStaff]

    def post(self, request, pk):
        slot = get_object_or_404(ReleaseSlot, pk=pk)
        serializer = AssignSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        form_request = serializer.validated_data["form_request"]
        form_request.release_slot = slot
        form_request.save(update_fields=["release_slot", "updated_at"])

        return Response(ReleaseSlotDetailSerializer(slot).data)


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
                f"This request is at {form_request.get_request_status_display()} and "
                f"cannot take this action. Expected: {expected_label}."
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

    Staff set the handover time as part of this step rather than the step
    only reading a value booked earlier, so a request can always be told to
    the student with a real date attached.

    Two paths coexist by design. Picking one of that date's ReleaseSlots
    books against its capacity; typing a freeform date and time schedules the
    release without consuming a bookable place, which is what Window 6 does
    when it tells someone to drop by outside the published windows. Either
    way release_date and release_time_start land on the ReleaseSchedule row,
    so nothing downstream has to know which path was taken.
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
        slot = serializer.validated_data.get("release_slot")
        release_date = serializer.validated_data["release_date"]
        release_time = serializer.validated_data.get("release_time_start")

        schedule, _ = ReleaseSchedule.objects.get_or_create(form_request=form_request)
        schedule.release_date = release_date
        schedule.release_time_start = release_time
        schedule.release_slot = slot
        schedule.save(
            update_fields=["release_date", "release_time_start", "release_slot", "updated_at"]
        )

        # FormRequest.release_slot stays the single source the Release Slots
        # page counts capacity from (it reads slot.form_requests). Mirroring
        # the choice onto it here is what makes a slot picked at this step
        # show up in that page's "X/Y filled", and clearing it for a freeform
        # time is what stops a request still counting against a window it is
        # no longer being handed over in.
        form_request.release_slot = slot
        form_request.request_status = FormRequest.RequestStatus.READY
        form_request.arrival_notice_sent_at = timezone.now()
        form_request.save(
            update_fields=[
                "release_slot",
                "request_status",
                "arrival_notice_sent_at",
                "updated_at",
            ]
        )

        when = f" on {release_date:%B %d, %Y}"
        if release_time is not None:
            when += f" at {release_time:%I:%M %p}"
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
