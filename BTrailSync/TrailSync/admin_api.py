"""The Admin portal's API: system-wide counts, a light activity feed, and account management."""
import logging
from datetime import datetime, time
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .academics import ordered_statuses
from .account_links import send_account_setup_email
from .models import FormRequest, Role, StaffProfile, TransactionType, User
from .views import FormRequestPagination

logger = logging.getLogger(__name__)

SELF_SERVICE_ROLES = (Role.RoleName.STUDENT, Role.RoleName.ALUMNI)
ROLE_FILTERS = {
    "student": Role.RoleName.STUDENT,
    "alumni": Role.RoleName.ALUMNI,
    "staff": Role.RoleName.REGISTRAR,
}


class IsAdminAccount(BasePermission):
    """Gate for every admin endpoint: an active account with the Admin role."""

    message = "Only administrators may access this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role_id
            and user.role.role_name == Role.RoleName.ADMIN
            and user.status == "Active"
        )


def _role_name(user):
    return user.role.role_name if user.role_id else None


def _name(user, middle_name=None):
    return " ".join(part for part in (user.first_name, middle_name, user.last_name) if part)


def account_state(user):
    """The one status label the Manage Accounts table shows, most urgent first."""
    if user.status != "Active":
        return "Suspended"
    role = _role_name(user)
    if role == Role.RoleName.REGISTRAR:
        profile = getattr(user, "staff_profile", None)
        if profile is None:
            return "No staff profile"
        # Separate from approval: admin-created accounts are approved at once but can't log in until set up.
        if profile.awaiting_setup:
            return "Awaiting Setup"
        if profile.approval_status != StaffProfile.ApprovalStatus.APPROVED:
            return profile.approval_status
        return "Active"
    if role in SELF_SERVICE_ROLES and not user.email_verified:
        return "Email not confirmed"
    return "Active"


def _can_change_status(user, request):
    # Administrators are managed outside this page, and nobody can lock themselves out.
    return user.pk != request.user.pk and _role_name(user) != Role.RoleName.ADMIN


class AccountRowSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    account_state = serializers.SerializerMethodField()
    can_change_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "status", "account_state", "date_joined", "can_change_status"]

    def get_name(self, obj):
        return _name(obj)

    def get_role(self, obj):
        return _role_name(obj)

    def get_account_state(self, obj):
        return account_state(obj)

    def get_can_change_status(self, obj):
        return _can_change_status(obj, self.context["request"])


class AdminAccountsPagination(FormRequestPagination):
    page_size = 15


class AdminAccountListView(generics.ListAPIView):
    """GET /api/admin/accounts/?role=all|student|alumni|staff&search= - every account, newest first."""

    permission_classes = [IsAdminAccount]
    serializer_class = AccountRowSerializer
    pagination_class = AdminAccountsPagination

    def get_queryset(self):
        qs = User.objects.select_related("role", "staff_profile").order_by("-date_joined", "-id")
        role = self.request.query_params.get("role", "all")
        if role in ROLE_FILTERS:
            qs = qs.filter(role__role_name=ROLE_FILTERS[role])
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            match = Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            parts = search.split()
            if len(parts) > 1:
                match |= Q(first_name__icontains=parts[0], last_name__icontains=parts[-1])
            qs = qs.filter(match)
        return qs


class AdminAccountDetailView(APIView):
    """GET /api/admin/accounts/<id>/ - one account with its student or staff profile."""

    permission_classes = [IsAdminAccount]

    def get(self, request, pk):
        user = get_object_or_404(
            User.objects.select_related("role", "user_profile", "staff_profile__approved_by"), pk=pk
        )
        data = AccountRowSerializer(user, context={"request": request}).data
        data.update(
            {
                "contact_number": user.contact_number,
                "email_verified": user.email_verified,
                "last_login": user.last_login,
                "student": None,
                "staff": None,
            }
        )
        profile = getattr(user, "user_profile", None)
        if profile is not None:
            latest = user.form_requests.order_by("-created_at").values_list("created_at", flat=True).first()
            data["name"] = _name(user, profile.middle_name)
            data["student"] = {
                "school_id_number": profile.school_id_number,
                "course": profile.course,
                "academic_status": ordered_statuses(profile.academic_status),
                "last_semester_attended": profile.last_semester_attended,
                "graduation_date": profile.graduation_date,
                "request_count": user.form_requests.count(),
                "last_request_at": latest,
            }
        staff = getattr(user, "staff_profile", None)
        if staff is not None:
            data["name"] = _name(user, staff.middle_name)
            data["staff"] = {
                "employee_id": staff.employee_id,
                "assigned_window": staff.assigned_window,
                "position": staff.position,
                "approval_status": staff.approval_status,
                "approved_by": (_name(staff.approved_by) or staff.approved_by.email) if staff.approved_by else None,
                "approved_at": staff.approved_at,
                "awaiting_setup": staff.awaiting_setup,
            }
        return Response(data)


class AdminAccountStatusView(APIView):
    """POST /api/admin/accounts/<id>/status/ {status: Active|Suspended} - suspend or reactivate an account."""

    permission_classes = [IsAdminAccount]

    def post(self, request, pk):
        user = get_object_or_404(User.objects.select_related("role", "staff_profile"), pk=pk)
        new_status = request.data.get("status")
        if new_status not in ("Active", "Suspended"):
            return Response({"status": ["Choose Active or Suspended."]}, status=status.HTTP_400_BAD_REQUEST)
        if user.pk == request.user.pk:
            return Response({"detail": "You can't suspend your own account."}, status=status.HTTP_400_BAD_REQUEST)
        if _role_name(user) == Role.RoleName.ADMIN:
            return Response(
                {"detail": "Administrator accounts can't be suspended from this page."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.status != new_status:
            user.status = new_status
            user.save(update_fields=["status"])
        return Response(AccountRowSerializer(user, context={"request": request}).data)


class CreateRegistrarSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150)
    employee_id = serializers.CharField(max_length=50)
    assigned_window = serializers.CharField(max_length=50)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_employee_id(self, value):
        value = value.strip()
        if StaffProfile.objects.filter(employee_id__iexact=value).exists():
            raise serializers.ValidationError("That employee ID is already in use.")
        return value


class AdminCreateRegistrarView(APIView):
    """POST /api/admin/accounts/registrar/ - create a pre-approved staff account and email its setup link.

    The admin never sets or sees a password: the account has an unusable one until the staff member chooses theirs.
    """

    permission_classes = [IsAdminAccount]

    def post(self, request):
        serializer = CreateRegistrarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        role = Role.objects.get(role_name=Role.RoleName.REGISTRAR)

        with transaction.atomic():
            user = User.objects.create_user(
                email=data["email"],
                password=None,
                first_name=data["first_name"].strip(),
                last_name=data["last_name"].strip(),
                role=role,
                status="Active",
                email_verified=False,
            )
            StaffProfile.objects.create(
                user=user,
                middle_name=(data.get("middle_name") or "").strip() or None,
                employee_id=data["employee_id"],
                assigned_window=data["assigned_window"].strip(),
                approval_status=StaffProfile.ApprovalStatus.APPROVED,
                approved_by=request.user,
                approved_at=timezone.now(),
            )

        try:
            send_account_setup_email(user)
            email_sent = True
            detail = f"Account created — setup email sent to {user.email}"
        except Exception:  # noqa: BLE001 - the account exists either way; the admin must be told the email didn't go
            logger.exception("Could not send the setup email to %s", user.email)
            email_sent = False
            detail = (
                f"Account created, but the setup email to {user.email} couldn't be sent. "
                'Open the account and use "Resend setup email".'
            )
        return Response(
            {
                "detail": detail,
                "email_sent": email_sent,
                "account": AccountRowSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminResendSetupView(APIView):
    """POST /api/admin/accounts/<id>/resend-setup/ - a fresh setup link for a staff account not yet set up."""

    permission_classes = [IsAdminAccount]

    def post(self, request, pk):
        user = get_object_or_404(User.objects.select_related("role", "staff_profile"), pk=pk)
        profile = getattr(user, "staff_profile", None)
        if profile is None or not profile.awaiting_setup:
            return Response({"detail": "This account has already been set up."}, status=status.HTTP_409_CONFLICT)
        if user.status != "Active":
            return Response(
                {"detail": "Reactivate this account before sending it a setup email."}, status=status.HTTP_409_CONFLICT
            )
        try:
            send_account_setup_email(user)
        except Exception:  # noqa: BLE001
            logger.exception("Could not resend the setup email to %s", user.email)
            return Response(
                {"detail": "The setup email couldn't be sent. Please try again in a moment."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"detail": f"Setup email sent to {user.email}."})


class AdminDashboardSummaryView(APIView):
    """GET /api/admin/dashboard/summary/ - system-wide account and request counts."""

    permission_classes = [IsAdminAccount]

    def get(self, request):
        by_role = dict(
            User.objects.filter(role__role_name__in=[*SELF_SERVICE_ROLES, Role.RoleName.REGISTRAR])
            .values_list("role__role_name")
            .annotate(n=Count("id"))
        )
        month_start = timezone.localdate().replace(day=1)
        since = timezone.make_aware(datetime.combine(month_start, time.min))
        return Response(
            {
                "students_count": by_role.get(Role.RoleName.STUDENT, 0),
                "alumni_count": by_role.get(Role.RoleName.ALUMNI, 0),
                "staff_count": by_role.get(Role.RoleName.REGISTRAR, 0),
                "requests_this_month_count": FormRequest.objects.filter(created_at__gte=since).count(),
                "month_label": month_start.strftime("%B %Y"),
            }
        )


class AdminActivityView(APIView):
    """GET /api/admin/dashboard/activity/ - the latest sign-ups and staff approvals, merged; not a full audit log."""

    permission_classes = [IsAdminAccount]

    def get(self, request):
        items = []
        recent_users = (
            User.objects.select_related("role")
            .filter(role__role_name__in=SELF_SERVICE_ROLES)
            .order_by("-date_joined")[:6]
        )
        for user in recent_users:
            items.append(
                {
                    "kind": "account_created",
                    "at": user.date_joined,
                    "title": f"{_name(user) or user.email} signed up",
                    "detail": f"{_role_name(user)} account",
                    "account_id": user.id,
                }
            )
        approvals = (
            StaffProfile.objects.select_related("user", "approved_by")
            .filter(approved_at__isnull=False)
            .order_by("-approved_at")[:6]
        )
        for profile in approvals:
            by = (_name(profile.approved_by) or profile.approved_by.email) if profile.approved_by else None
            items.append(
                {
                    "kind": "staff_approved",
                    "at": profile.approved_at,
                    "title": f"Registrar account approved for {_name(profile.user, profile.middle_name) or profile.user.email}",
                    "detail": " · ".join(
                        part for part in (f"By {by}" if by else None, "Awaiting setup" if profile.awaiting_setup else None) if part
                    ),
                    "account_id": profile.user_id,
                }
            )
        items.sort(key=lambda item: item["at"], reverse=True)
        return Response({"results": items[:8]})


# Document types: what an admin updates when Window 6 announces a new fee, turnaround or a paused document.

def _document_types():
    # Requests the Registrar hasn't approved yet: the only ones a fee change will still reach.
    awaiting = Q(form_requests__request_status__in=[FormRequest.RequestStatus.SUBMITTED, FormRequest.RequestStatus.VERIFIED])
    return TransactionType.objects.annotate(awaiting_assessment=Count("form_requests", filter=awaiting)).order_by("name")


class AdminDocumentTypeSerializer(serializers.ModelSerializer):
    """One row of Manage Document Types. A null fee means "no published fee", which the Registrar assesses as none."""

    fee_amount = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=Decimal("0"),
        allow_null=True,
        required=False,
        error_messages={
            "invalid": "Enter the fee as an amount, like 125.00.",
            "min_value": "The fee can't be negative.",
            "max_digits": "That fee is too large; check the amount.",
            "max_whole_digits": "That fee is too large; check the amount.",
            "max_decimal_places": "Use at most two decimal places (centavos).",
        },
    )
    awaiting_assessment = serializers.IntegerField(read_only=True)

    class Meta:
        model = TransactionType
        fields = ["id", "name", "fee_amount", "pricing_unit", "processing_time", "is_available", "updated_at", "awaiting_assessment"]
        read_only_fields = ["id", "name", "updated_at", "awaiting_assessment"]
        extra_kwargs = {"pricing_unit": {"error_messages": {"invalid_choice": "Choose Flat or Per page."}}}

    def validate_processing_time(self, value):
        return (value or "").strip() or None


class AdminDocumentTypeListView(generics.ListAPIView):
    """GET /api/admin/document-types/ - every document with its fee, and how many requests still await assessment."""

    permission_classes = [IsAdminAccount]
    serializer_class = AdminDocumentTypeSerializer

    def get_queryset(self):
        return _document_types()


class AdminDocumentTypeDetailView(APIView):
    """PATCH /api/admin/document-types/<id>/ - fee, pricing unit, processing time or availability.

    Applies from the next assessment: amount_due is stored on each request when the Registrar approves it and is never
    recomputed, so requests already approved keep the fee they were given.
    """

    permission_classes = [IsAdminAccount]

    def patch(self, request, pk):
        document = get_object_or_404(_document_types(), pk=pk)
        before = {field: getattr(document, field) for field in ("fee_amount", "pricing_unit", "processing_time", "is_available")}
        serializer = AdminDocumentTypeSerializer(document, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        changes = {field: (old, getattr(document, field)) for field, old in before.items() if old != getattr(document, field)}
        if changes:
            logger.info("Admin %s updated document type %r: %s", request.user.email, document.name, changes)
        return Response(AdminDocumentTypeSerializer(get_object_or_404(_document_types(), pk=pk)).data)
