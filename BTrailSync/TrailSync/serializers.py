import json
import re
import uuid
from datetime import date, datetime
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .academics import (
    ACADEMIC_STATUS_OPTIONS,
    ARCHIVE_STATUSES,
    is_alumnus,
    is_student,
    normalize_semester,
    ordered_statuses,
)
from .models import (
    FormRequest,
    FormSubmission,
    Notification,
    ReleaseSchedule,
    RequestProxy,
    RequirementVerification,
    Role,
    StaffProfile,
    SubmissionAttachment,
    TransactionType,
    User,
    UserProfile,
)


def absolute_media_url(file_field):
    """Absolute URL for a stored file, or None; relative media paths would resolve against the frontend's origin."""
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    return urljoin(settings.BACKEND_BASE_URL.rstrip("/") + "/", url.lstrip("/"))


def _validated_semester(value):
    """A last-semester answer in its canonical spelling, or the student-facing reason it isn't plausible."""
    try:
        return normalize_semester(value, today=timezone.localdate())
    except ValueError as exc:
        raise serializers.ValidationError(str(exc))


def build_profile_payload(user):
    """The same profile shape LoginView returns, reused by /api/me/."""
    if hasattr(user, "user_profile"):
        p = user.user_profile
        return {
            "school_id_number": p.school_id_number,
            "first_name": user.first_name,
            "middle_name": p.middle_name,
            "last_name": user.last_name,
            "course": p.course,
            "academic_status": ordered_statuses(p.academic_status),
            "last_semester_attended": p.last_semester_attended,
            # Absolute; null means "no photo, show initials".
            "profile_picture_url": absolute_media_url(p.profile_picture),
            "tour_completed_at": p.tour_completed_at.isoformat() if p.tour_completed_at else None,
            "graduation_date": p.graduation_date.isoformat() if p.graduation_date else None,
            "birth_date": p.birth_date.isoformat() if p.birth_date else None,
            # Computed on every read. academic_locked: once a request exists, ID, course and academic status change only at Window 6.
            "onboarding": {
                **{k: v for k, v in p.onboarding_state().items() if k != "steps_done"},
                "academic_locked": user.form_requests.exists(),
            },
        }
    if hasattr(user, "staff_profile"):
        s = user.staff_profile
        return {
            "employee_id": s.employee_id,
            "assigned_window": s.assigned_window,
            "position": s.position,
        }
    return None


class NotificationSerializer(serializers.ModelSerializer):
    """One row of a student's notification inbox. Read-only."""

    request_code = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "is_read",
            "read_at",
            "created_at",
            "request_code",
        ]
        read_only_fields = fields

    def get_request_code(self, obj):
        return obj.form_request.request_code if obj.form_request_id else None


class MeSerializer(serializers.Serializer):
    """Read-only 'who am I' payload for GET /api/me/."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    contact_number = serializers.CharField(allow_null=True)
    email_verified = serializers.BooleanField()
    role = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    def get_role(self, user):
        return user.role.role_name if user.role_id else None

    def get_profile(self, user):
        return build_profile_payload(user)


class UpdateProfileSerializer(serializers.Serializer):
    """PATCH /api/me/ body: only the fields a student may edit; official records stay read-only."""

    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    # Changes every term for a continuing student, so unlike the academic records it stays editable. Omitted = unchanged.
    last_semester_attended = serializers.CharField(
        max_length=40, required=False, error_messages={"blank": "Please enter the last semester you attended."}
    )

    def validate_last_semester_attended(self, value):
        return _validated_semester(value)

    @transaction.atomic
    def save(self, **kwargs):
        user = self.context["request"].user
        data = self.validated_data

        user.first_name = data["first_name"].strip()
        user.last_name = data["last_name"].strip()
        user.contact_number = (data.get("contact_number") or "").strip() or None
        user.save(update_fields=["first_name", "last_name", "contact_number"])

        profile = getattr(user, "user_profile", None)
        if profile is not None:
            profile.middle_name = (data.get("middle_name") or "").strip() or None
            fields = ["middle_name"]
            if "last_semester_attended" in data:
                profile.last_semester_attended = data["last_semester_attended"]
                fields.append("last_semester_attended")
            profile.save(update_fields=fields)

        return user


class ChangePasswordSerializer(serializers.Serializer):
    """POST /api/me/change-password/ body."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_new_password"]:
            raise serializers.ValidationError({"confirm_new_password": "Passwords don't match."})

        user = self.context["request"].user
        try:
            validate_password(attrs["new_password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class ChangeEmailRequestSerializer(serializers.Serializer):
    """POST /api/me/change-email/request/ body; the email changes only when the emailed link is used."""

    new_email = serializers.EmailField()

    def validate_new_email(self, value):
        value = value.strip().lower()
        user = self.context["request"].user
        if User.objects.exclude(pk=user.pk).filter(email__iexact=value).exists():
            raise serializers.ValidationError("That email is already in use by another account.")
        if value == user.email.lower():
            raise serializers.ValidationError("That's already your current email.")
        return value


class ChangeEmailConfirmSerializer(serializers.Serializer):
    """POST /api/me/change-email/confirm/ body."""

    token = serializers.CharField()


class TrackedFormRequestSerializer(serializers.ModelSerializer):
    """GET /api/form-requests/ row: what the Track Requests ticket needs. Read-only, and never exposes staff-only fields."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    # With amount_due still null, tells the ticket the fee waits on the Registrar's page count.
    pricing_unit = serializers.CharField(source="transaction_type.pricing_unit", read_only=True)
    purpose = serializers.SerializerMethodField()
    purpose_other = serializers.SerializerMethodField()
    number_of_copies = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    additional_notes = serializers.SerializerMethodField()
    graduation_date = serializers.SerializerMethodField()
    proxy = serializers.SerializerMethodField()
    verification_remarks = serializers.SerializerMethodField()
    release_schedule = serializers.SerializerMethodField()
    receipt_available = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_change_proxy = serializers.SerializerMethodField()
    uploaded_files = serializers.SerializerMethodField()

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "request_status",
            "cancelled_at",
            "transaction_type",
            "pricing_unit",
            "created_at",
            "requires_archive_retrieval",
            "purpose",
            "purpose_other",
            "number_of_copies",
            # Read-only: set by the Registrar at approval, never by the student.
            "page_count",
            "semester",
            "additional_notes",
            "graduation_date",
            "proxy",
            "verification_remarks",
            "release_schedule",
            # Safe for a student to read; clearance, or_number and duplicate_flag are intentionally absent.
            "amount_due",
            "payment_date",
            # Decided by the API so each button and its endpoint's own gate always agree.
            "receipt_available",
            "can_cancel",
            "can_change_proxy",
            # Switched on when staff log the payment, so the student has something to show at Window 6.
            "digital_stub_active",
            # Read-only here; attachments are only written at submission.
            "uploaded_files",
        ]
        read_only_fields = fields

    def _form_data(self, obj):
        submission = getattr(obj, "submission", None)
        return (submission.form_data if submission else None) or {}

    def get_purpose(self, obj):
        return self._form_data(obj).get("purpose")

    def get_purpose_other(self, obj):
        return self._form_data(obj).get("purpose_other") or None

    def get_number_of_copies(self, obj):
        return self._form_data(obj).get("number_of_copies")

    def get_semester(self, obj):
        return self._form_data(obj).get("semester")

    def get_additional_notes(self, obj):
        return self._form_data(obj).get("additional_notes") or ""

    def get_graduation_date(self, obj):
        return self._form_data(obj).get("graduation_date") or None

    def get_proxy(self, obj):
        proxy = getattr(obj, "proxy", None)
        if proxy is None:
            return None
        return {
            "proxy_full_name": proxy.proxy_full_name,
            "relationship": proxy.relationship,
            "contact_number": proxy.contact_number,
        }

    def get_verification_remarks(self, obj):
        # The most recent verification event is the current one.
        latest = obj.verifications.first()
        return latest.remarks if latest else None

    def get_receipt_available(self, obj):
        return obj.receipt_available()

    def get_can_cancel(self, obj):
        return obj.can_cancel()

    def get_can_change_proxy(self, obj):
        return obj.can_change_proxy()

    def get_uploaded_files(self, obj):
        return serialize_attachments(obj)

    def get_release_schedule(self, obj):
        slot = obj.release_slot
        schedule = getattr(obj, "release_schedule", None)
        if slot is None and schedule is None:
            return None

        data = {}
        if slot is not None:
            data.update(
                {
                    "slot_date": slot.slot_date.isoformat(),
                    "start_time": slot.start_time.isoformat(timespec="minutes"),
                    "end_time": slot.end_time.isoformat(timespec="minutes"),
                }
            )
        if schedule is not None:
            data.update(
                {
                    "claimed_at": schedule.claimed_at.isoformat() if schedule.claimed_at else None,
                    "claimant_name": schedule.claimant_name,
                }
            )
        # The pickup date as staff set it, via the one accessor that knows the precedence.
        when = obj.scheduled_release()
        if when is not None:
            data["release_date"] = when[0].isoformat()
            data["release_time_start"] = when[1].isoformat(timespec="minutes") if when[1] else None
        return data


class RegistrarRecentSubmissionSerializer(serializers.ModelSerializer):
    """GET /api/registrar/dashboard/recent-submissions/ row shape."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)
    student_profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "request_status",
            "transaction_type",
            "created_at",
            "student_profile_picture_url",
            "student_first_name",
            "student_last_name",
        ]

    def get_student_profile_picture_url(self, obj):
        profile = getattr(obj.user, "user_profile", None)
        return absolute_media_url(profile.profile_picture) if profile else None


class RegistrarTodaysPickupRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/dashboard/todays-pickups/ row shape; the frontend derives waiting/collected from request_status."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)
    start_time = serializers.SerializerMethodField()

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "request_status",
            "transaction_type",
            "student_first_name",
            "student_last_name",
            "start_time",
            # A proxy added or changed at Ready for Pickup, so the desk expects someone other than the student.
            "proxy_changed_at",
        ]

    def get_start_time(self, obj):
        # Reads the schedule (which also covers legacy slots).
        when = obj.scheduled_release()
        start = when[1] if when else None
        return start.isoformat(timespec="minutes") if start else None


class RegistrarReleasedRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/released/ row: narrower than the .xlsx export."""

    date_released = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    student_course = serializers.SerializerMethodField()
    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    claimed_by = serializers.SerializerMethodField()
    claimed_by_proxy = serializers.SerializerMethodField()

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "date_released",
            "student_name",
            "student_course",
            "transaction_type",
            "amount_due",
            "or_number",
            "claimed_by",
            "claimed_by_proxy",
        ]

    def _schedule(self, obj):
        return getattr(obj, "release_schedule", None)

    def get_date_released(self, obj):
        schedule = self._schedule(obj)
        return schedule.claimed_at if schedule else None

    def get_student_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_student_course(self, obj):
        profile = getattr(obj.user, "user_profile", None)
        return profile.course if profile else None

    def get_claimed_by(self, obj):
        schedule = self._schedule(obj)
        return schedule.claimant_name if schedule else None

    def get_claimed_by_proxy(self, obj):
        """Whether an authorised proxy was on file; the typed claimant name can't answer this."""
        return getattr(obj, "proxy", None) is not None


class RegistrarQueueRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/queue/ row, also used by the review page."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)
    student_school_id_number = serializers.SerializerMethodField()
    student_course = serializers.SerializerMethodField()
    student_academic_status = serializers.SerializerMethodField()
    graduation_date = serializers.SerializerMethodField()
    purpose = serializers.SerializerMethodField()
    purpose_other = serializers.SerializerMethodField()
    number_of_copies = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    additional_notes = serializers.SerializerMethodField()
    requirements_status = serializers.SerializerMethodField()
    uploaded_files = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    verification_remarks = serializers.SerializerMethodField()
    proxy = serializers.SerializerMethodField()
    student_full_name = serializers.SerializerMethodField()
    # What the approval step needs to show fee x pages x copies + add-ons before it is committed.
    pricing_unit = serializers.CharField(source="transaction_type.pricing_unit", read_only=True)
    fee_amount = serializers.DecimalField(
        source="transaction_type.fee_amount", max_digits=8, decimal_places=2, read_only=True
    )
    fee_add_ons = serializers.SerializerMethodField()
    # Echoed back by the Release action, which refuses if the proxy has changed since the page was loaded.
    proxy_version = serializers.SerializerMethodField()
    submission_extras = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    release_schedule = serializers.SerializerMethodField()

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "request_status",
            "transaction_type",
            "created_at",
            "student_first_name",
            "student_last_name",
            "student_school_id_number",
            "student_course",
            "student_academic_status",
            "graduation_date",
            "purpose",
            "purpose_other",
            "number_of_copies",
            "pricing_unit",
            "fee_amount",
            "fee_add_ons",
            "page_count",
            "submission_extras",
            "semester",
            "additional_notes",
            "requirements_status",
            "uploaded_files",
            "attachment_count",
            "verification_remarks",
            "proxy",
            "student_full_name",
            # Lifecycle state the review page renders and gates its actions on.
            "is_rush",
            # Staff-facing fraud signal; the student serializer omits it.
            "duplicate_flag",
            "amount_due",
            "or_number",
            "payment_date",
            "approved_by_name",
            "verified_by_name",
            "registrar_approved_at",
            "release_schedule",
            "cancelled_at",
            "proxy_changed_at",
            "proxy_version",
        ]

    def _profile(self, obj):
        return getattr(obj.user, "user_profile", None)

    def get_student_school_id_number(self, obj):
        p = self._profile(obj)
        return p.school_id_number if p else None

    def get_student_course(self, obj):
        p = self._profile(obj)
        return p.course if p else None

    def get_student_academic_status(self, obj):
        """As it stood when the request was filed, falling back to the profile for requests filed before it was recorded."""
        filed = self._form_data(obj).get("academic_status")
        if filed:
            return ordered_statuses(filed)
        p = self._profile(obj)
        return ordered_statuses(p.academic_status) if p else []

    def get_graduation_date(self, obj):
        return self._form_data(obj).get("graduation_date") or None

    def get_fee_add_ons(self, obj):
        return f"{obj.fee_add_ons():.2f}"

    def get_proxy_version(self, obj):
        return proxy_version(obj)

    def _form_data(self, obj):
        submission = getattr(obj, "submission", None)
        return (submission.form_data if submission else None) or {}

    def get_purpose(self, obj):
        return self._form_data(obj).get("purpose")

    def get_purpose_other(self, obj):
        return self._form_data(obj).get("purpose_other") or None

    def get_number_of_copies(self, obj):
        return self._form_data(obj).get("number_of_copies")

    def get_semester(self, obj):
        return self._form_data(obj).get("semester")

    def get_additional_notes(self, obj):
        return self._form_data(obj).get("additional_notes") or ""

    def get_requirements_status(self, obj):
        """A Board Exam request needs its 2x2 photo; required_documents can't be checked against uploads."""
        submission = getattr(obj, "submission", None)
        if self._form_data(obj).get("purpose") == FormSubmission.Purpose.BOARD_EXAM:
            return "Complete" if (submission and submission.board_exam_photo) else "Incomplete"
        return "Complete"

    def get_attachment_count(self, obj):
        submission = getattr(obj, "submission", None)
        return submission.attachments.count() if submission else 0

    def get_uploaded_files(self, obj):
        """Every file the student uploaded with this request."""
        return serialize_attachments(obj)

    def get_verification_remarks(self, obj):
        latest = obj.verifications.first()
        return latest.remarks if latest else None

    def get_proxy(self, obj):
        proxy = getattr(obj, "proxy", None)
        if proxy is None:
            return None
        return {
            "proxy_full_name": proxy.proxy_full_name,
            "relationship": proxy.relationship,
            "contact_number": proxy.contact_number,
        }

    def get_student_full_name(self, obj):
        """Pre-fills the claimant on the Release action: the student, unless a proxy is collecting."""
        p = self._profile(obj)
        parts = [obj.user.first_name or ""]
        if p is not None and p.middle_name:
            parts.append(p.middle_name)
        parts.append(obj.user.last_name or "")
        return " ".join(x for x in parts if x).strip() or obj.user.email

    def get_submission_extras(self, obj):
        """Conditional answers as a flat label/value list the review page can render as-is."""
        data = self._form_data(obj)
        pairs = (
            ("CAV Agency", data.get("cav_agency")),
            ("Certification Type", ", ".join(data.get("certification_subtypes") or []) or None),
            ("Semester Taken", data.get("semester_taken")),
            ("Subject Code", data.get("subject_code")),
        )
        return [{"label": label, "value": value} for label, value in pairs if value]

    def get_approved_by_name(self, obj):
        approver = obj.registrar_approved_by
        return approver.user.get_full_name() if approver else None

    def get_verified_by_name(self, obj):
        """Who signed the Front Desk line, from the verification event."""
        latest = obj.verifications.filter(verification_status="Verified").first()
        return latest.verified_by.user.get_full_name() if (latest and latest.verified_by) else None

    def get_release_schedule(self, obj):
        """The booking merged with the claim record; an unscheduled request is visibly unscheduled."""
        slot = obj.release_slot
        schedule = getattr(obj, "release_schedule", None)
        if slot is None and schedule is None:
            return None

        data = {}
        if slot is not None:
            data.update(
                {
                    "slot_date": slot.slot_date.isoformat(),
                    "start_time": slot.start_time.isoformat(timespec="minutes"),
                    "end_time": slot.end_time.isoformat(timespec="minutes"),
                }
            )
        if schedule is not None:
            data.update(
                {
                    "release_status": schedule.release_status,
                    "claimed_at": schedule.claimed_at.isoformat() if schedule.claimed_at else None,
                    "claimant_name": schedule.claimant_name,
                    # What Mark Ready stored, so the review page pre-fills rather than overwriting.
                    "release_date": schedule.release_date.isoformat() if schedule.release_date else None,
                    "release_time_start": (
                        schedule.release_time_start.isoformat(timespec="minutes")
                        if schedule.release_time_start
                        else None
                    ),
                    "release_slot_id": schedule.release_slot_id,
                }
            )
        return data


class ApproveLogSerializer(serializers.Serializer):
    """Payload for logging a Cashier payment (Approved -> Processing)."""

    or_number = serializers.CharField(max_length=50, allow_blank=False, trim_whitespace=True)
    payment_date = serializers.DateField()


class MarkReadySerializer(serializers.Serializer):
    """Payload for Mark Ready to Release: only a date, since the window is always 3:00 to 5:00 PM."""

    release_date = serializers.DateField()


class ReleaseRequestSerializer(serializers.Serializer):
    """Payload for the terminal Release action; the view decides whether proxy_acknowledged is required."""

    claimant_name = serializers.CharField(max_length=150, allow_blank=False, trim_whitespace=True)
    proxy_acknowledged = serializers.BooleanField(required=False, default=False)
    # The proxy_version the page showed; omitted, the check is skipped.
    proxy_version = serializers.CharField(required=False, allow_blank=True)


def proxy_version(form_request):
    """Changes whenever the proxy does, so an out-of-date Release screen can be caught; only the late path edits a proxy."""
    if getattr(form_request, "proxy", None) is None:
        return "none"
    changed = form_request.proxy_changed_at
    return changed.isoformat() if changed else "as-submitted"


class ProxyAssignmentSerializer(serializers.Serializer):
    """PUT /api/form-requests/<id>/proxy/ body: the same three answers the request form asks for."""

    proxy_full_name = serializers.CharField(
        max_length=150, error_messages={"blank": "Proxy full name is required.", "required": "Proxy full name is required."}
    )
    relationship = serializers.ChoiceField(
        choices=RequestProxy.Relationship.choices,
        error_messages={"invalid_choice": "Please select a relationship.", "required": "Please select a relationship."},
    )
    contact_number = serializers.CharField(
        max_length=20, error_messages={"blank": "Contact number is required.", "required": "Contact number is required."}
    )

    def validate_proxy_full_name(self, value):
        return value.strip()

    def validate_contact_number(self, value):
        return value.strip()


class VerifyRequestSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True)


class ApproveRequestSerializer(serializers.Serializer):
    """Registrar approval. page_count (pages per copy) is required for per-page documents and ignored for flat-fee ones."""

    page_count = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
        max_value=999,
        error_messages={
            "invalid": "Enter the page count as a whole number.",
            "min_value": "The page count has to be at least 1.",
            "max_value": "Please check the page count; it looks too high.",
        },
    )

    def validate(self, attrs):
        if self.context["transaction_type"].pricing_unit == "per_page":
            if not attrs.get("page_count"):
                raise serializers.ValidationError(
                    {"page_count": "Enter how many pages the record runs to; this document is charged per page."}
                )
        else:
            attrs["page_count"] = None
        return attrs


class RejectRequestSerializer(serializers.Serializer):
    # Required by the API too, not just by the disabled button.
    remarks = serializers.CharField(allow_blank=False, error_messages={"blank": "Review remarks are required to reject a request."})


class RecentFormRequestSerializer(serializers.ModelSerializer):
    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)

    class Meta:
        model = FormRequest
        fields = ["request_code", "transaction_type", "request_status", "created_at"]


class TransactionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionType
        fields = [
            "id",
            "name",
            "description",
            "required_documents",
            "processing_time",
            "fee_amount",
            # Tells the request form whether to ask for a page count.
            "pricing_unit",
            "common_purposes",
            "special_notes",
            "is_available",
        ]


class FormRequestResultSerializer(serializers.ModelSerializer):
    """The response after a successful submission, for the confirmation screen."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)

    class Meta:
        model = FormRequest
        fields = ["id", "request_code", "request_status", "transaction_type", "created_at"]


def _generate_request_code():
    """W6-0XX, unique; the retry loop is a safety net for simultaneous submissions."""
    for _ in range(5):
        candidate = f"W6-{FormRequest.objects.count() + 1:03d}"
        if not FormRequest.objects.filter(request_code=candidate).exists():
            return candidate
    return f"W6-{uuid.uuid4().hex[:8].upper()}"


def _parse_json_object(raw, field_name):
    """form_data and proxy arrive as JSON strings, because the request is always multipart."""
    if raw in (None, ""):
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        raise serializers.ValidationError({field_name: ["Invalid data."]})
    if not isinstance(parsed, dict):
        raise serializers.ValidationError({field_name: ["Invalid data."]})
    return parsed


def _parse_iso_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


# Sub-selections inside a single document type, stored in form_data rather than as types of their own.
CAV_AGENCIES = ["DFA", "CHED", "DEP-ED", "PNP", "POEA", "BFP", "BJMP", "Others"]

CERTIFICATION_SUBTYPES = [
    "CAR",
    "GPA",
    "Endorsement",
    "Officially enrolled",
    "Subjects enrolled",
    "USTP Conversion",
    "English Medium of Instruction",
    "Authorization Letter",
    "Letter of No Objection",
    "Graduated",
    "Earned units",
    "Grading System",
    "Subjects w/ grades",
    "Others",
]

# Bounds on student uploads, so one request can't fill the disk.
MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
BOARD_EXAM_PHOTO_BYTES = 5 * 1024 * 1024

# Label -> the bytes a real file of that kind starts with; names and Content-Type prove nothing.
FILE_SIGNATURES = {
    "JPG": (b"\xff\xd8\xff",),
    "PNG": (b"\x89PNG\r\n\x1a\n",),
    "PDF": (b"%PDF-",),
}
BOARD_EXAM_PHOTO_TYPES = ("JPG", "PNG")
ATTACHMENT_TYPES = ("PDF", "JPG", "PNG")


def _human_list(items):
    items = list(items)
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} or {items[-1]}"


def check_upload(upload, allowed, max_bytes, label):
    """Raise a plain-language ValidationError naming the accepted types or the actual size limit."""
    limit_mb = max_bytes // (1024 * 1024)
    if upload.size > max_bytes:
        size_mb = upload.size / (1024 * 1024)
        raise serializers.ValidationError(
            f"{label} is {size_mb:.1f} MB. The limit is {limit_mb} MB."
        )
    head = upload.read(16)
    upload.seek(0)
    if not any(head.startswith(sig) for kind in allowed for sig in FILE_SIGNATURES[kind]):
        raise serializers.ValidationError(
            f"{label} isn't a {_human_list(allowed)} file. Please choose a {_human_list(allowed)}."
        )


def serialize_attachments(form_request):
    """The uploaded files for one request, the same list for staff and student, with board_exam_photo folded in."""
    rows = []

    submission = getattr(form_request, "submission", None)
    if submission is None:
        return rows

    if submission.board_exam_photo:
        f = submission.board_exam_photo
        try:
            size = f.size
        except (OSError, ValueError):
            size = None
        rows.append(
            {
                "id": None,
                "file_name": f.name.rsplit("/", 1)[-1],
                "file_url": absolute_media_url(f),
                "file_size": size,
                "kind": "board_exam_photo",
                "uploaded_at": submission.created_at.isoformat(),
            }
        )

    for att in submission.attachments.all():
        rows.append(
            {
                "id": att.id,
                "file_name": att.file_name,
                "file_url": absolute_media_url(att.file),
                "file_size": att.file_size,
                "kind": "attachment",
                "uploaded_at": att.uploaded_at.isoformat(),
            }
        )
    return rows


class CreateFormRequestSerializer(serializers.Serializer):
    """POST /api/form-requests/ body (multipart). The user always comes from request.user; validate() enforces the JSON fields."""

    transaction_type = serializers.PrimaryKeyRelatedField(
        queryset=TransactionType.objects.all(),
        error_messages={"does_not_exist": "Please choose a document from the list."},
    )
    form_data = serializers.CharField()
    proxy = serializers.CharField(required=False, allow_blank=True)
    board_exam_photo = serializers.FileField(required=False)

    def validate_transaction_type(self, value):
        if not value.is_available:
            raise serializers.ValidationError("This document type isn't currently available for request.")
        return value

    def validate_board_exam_photo(self, value):
        # Checked here too, since the endpoint can be called without the form.
        check_upload(value, BOARD_EXAM_PHOTO_TYPES, BOARD_EXAM_PHOTO_BYTES, "The 2x2 photo")
        return value

    # Attachments arrive as a repeated multipart key that only request.FILES.getlist can read, so they are checked in validate().

    def _attachments(self):
        request = self.context.get("request")
        if request is None:
            return []
        return request.FILES.getlist("attachments")

    def validate_form_data(self, raw):
        parsed = _parse_json_object(raw, "form_data")
        if parsed is None:
            raise serializers.ValidationError("This field is required.")
        return parsed

    def validate_proxy(self, raw):
        return _parse_json_object(raw, "proxy")

    def validate(self, attrs):
        errors = {}
        form_data = attrs["form_data"]
        user = self.context["request"].user
        profile = getattr(user, "user_profile", None)

        # The official form is printed from the profile, so an incomplete profile can't file a request.
        if profile is None or not profile.onboarding_state()["complete"]:
            raise serializers.ValidationError(
                {"detail": "Please finish setting up your profile before requesting a document."}
            )
        statuses = ordered_statuses(profile.academic_status)
        is_alumni = is_alumnus(statuses)
        # The Registrar counts pages at approval; a student-supplied count is never stored.
        form_data.pop("number_of_pages", None)

        purpose = (form_data.get("purpose") or "").strip()
        if not purpose:
            errors.setdefault("form_data", {})["purpose"] = "Please select a purpose."
        elif purpose not in FormSubmission.Purpose.values:
            errors.setdefault("form_data", {})["purpose"] = "Please select a valid purpose."
        if purpose == FormSubmission.Purpose.OTHERS and not (form_data.get("purpose_other") or "").strip():
            errors.setdefault("form_data", {})["purpose_other"] = "Please specify your purpose."

        try:
            copies = int(form_data.get("number_of_copies", 0))
        except (TypeError, ValueError):
            copies = 0
        if copies < 1:
            errors.setdefault("form_data", {})["number_of_copies"] = "Enter at least 1 copy."

        # Printed on the form as the last semester attended; prefilled from the profile but answered per request.
        semester = form_data.get("semester")
        if not (isinstance(semester, str) and semester.strip()):
            errors.setdefault("form_data", {})["semester"] = "Please enter the last semester you attended."
        else:
            try:
                form_data["semester"] = _validated_semester(semester)
            except serializers.ValidationError as exc:
                errors.setdefault("form_data", {})["semester"] = exc.detail[0]

        transaction_type = attrs["transaction_type"]

        # The one purpose with its own fee and its own two fields.
        if purpose == FormSubmission.Purpose.COMPLETION_OF_INC:
            if not (form_data.get("semester_taken") or "").strip():
                errors.setdefault("form_data", {})["semester_taken"] = (
                    "Please state the semester and school year the INC was taken."
                )
            if not (form_data.get("subject_code") or "").strip():
                errors.setdefault("form_data", {})["subject_code"] = (
                    "Please state the subject code."
                )

        # Sub-selections belonging to one document type each.
        if transaction_type.name == "CAV Certification":
            agency = (form_data.get("cav_agency") or "").strip()
            if not agency:
                errors.setdefault("form_data", {})["cav_agency"] = (
                    "Please select which agency the CAV is for."
                )
            elif agency not in CAV_AGENCIES:
                errors.setdefault("form_data", {})["cav_agency"] = "Please select a valid agency."

        if transaction_type.name == "Certification":
            subtypes = form_data.get("certification_subtypes") or []
            if not isinstance(subtypes, list) or not subtypes:
                errors.setdefault("form_data", {})["certification_subtypes"] = (
                    "Please select at least one certification type."
                )
            elif any(x not in CERTIFICATION_SUBTYPES for x in subtypes):
                errors.setdefault("form_data", {})["certification_subtypes"] = (
                    "One or more selected certification types are not recognised."
                )

        # Anyone with an Alumnus option; everyone else's form leaves the graduation line blank.
        graduation_date = None
        if is_alumni:
            raw_grad_date = (form_data.get("graduation_date") or "").strip()
            graduation_date = _parse_iso_date(raw_grad_date)
            if graduation_date is None:
                errors.setdefault("form_data", {})["graduation_date"] = "Please enter your graduation date."
            elif graduation_date > timezone.localdate():
                errors.setdefault("form_data", {})["graduation_date"] = "Your graduation date can't be in the future."
        else:
            form_data.pop("graduation_date", None)

        # System-enforced, not a dismissible warning.
        if purpose == FormSubmission.Purpose.BOARD_EXAM and not attrs.get("board_exam_photo"):
            errors.setdefault("form_data", {})[
                "board_exam_photo"
            ] = "Please upload a white-background 2x2 photo for this request."

        attachments = self._attachments()
        if len(attachments) > MAX_ATTACHMENTS:
            errors["attachments"] = f"Attach at most {MAX_ATTACHMENTS} files."
        else:
            problems = []
            for f in attachments:
                try:
                    check_upload(f, ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, f"“{f.name}”")
                except serializers.ValidationError as exc:
                    problems.extend(str(d) for d in exc.detail)
            if problems:
                errors["attachments"] = " ".join(problems)

        proxy = attrs.get("proxy")
        if proxy is not None:
            if not (proxy.get("proxy_full_name") or "").strip():
                errors.setdefault("proxy", {})["proxy_full_name"] = "Proxy full name is required."
            if proxy.get("relationship") not in RequestProxy.Relationship.values:
                errors.setdefault("proxy", {})["relationship"] = "Please select a relationship."
            if not (proxy.get("contact_number") or "").strip():
                errors.setdefault("proxy", {})["contact_number"] = "Contact number is required."

        if errors:
            raise serializers.ValidationError(errors)

        # Recorded with the request, so its printed form keeps the status it was filed under.
        form_data["academic_status"] = statuses
        attrs["_graduation_date"] = graduation_date
        attrs["_archive_status"] = any(s in ARCHIVE_STATUSES for s in statuses)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        form_data = validated_data["form_data"]
        graduation_date = validated_data["_graduation_date"]

        # Pre-2018 college records sit in the archive; a high school alumnus's don't, whatever the date.
        requires_archive = bool(
            validated_data["_archive_status"] and graduation_date and graduation_date < date(2018, 1, 1)
        )

        form_request = FormRequest.objects.create(
            user=user,
            transaction_type=validated_data["transaction_type"],
            request_code=_generate_request_code(),
            requires_archive_retrieval=requires_archive,
        )
        submission = FormSubmission.objects.create(
            form_request=form_request,
            form_data=form_data,
            board_exam_photo=validated_data.get("board_exam_photo"),
        )

        # Written only here, by the student at submission; staff never upload on a student's behalf.
        for uploaded in self._attachments():
            SubmissionAttachment.objects.create(
                form_submission=submission,
                file=uploaded,
                file_name=uploaded.name,
                file_size=uploaded.size,
            )

        proxy = validated_data.get("proxy")
        if proxy:
            RequestProxy.objects.create(
                form_request=form_request,
                proxy_full_name=proxy["proxy_full_name"].strip(),
                relationship=proxy["relationship"],
                contact_number=proxy["contact_number"].strip(),
            )

        return form_request


class RegisterSerializer(serializers.Serializer):
    """Student/alumni self-registration: email and password only; the profile comes from onboarding."""

    # Any well-formed address: alumni may no longer have a school mailbox.
    email = serializers.EmailField(
        error_messages={"invalid": "Please enter a valid email address, like juan@gmail.com."}
    )
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "There's already an account with this email. Try logging in instead."
            )
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})

        # Run Django's password validators against an unsaved User, so the similarity check can compare with the email.
        try:
            validate_password(attrs["password"], User(email=attrs.get("email", "")))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Student until onboarding step 2 sets the category.
        try:
            role = Role.objects.get(role_name=Role.RoleName.STUDENT)
        except Role.DoesNotExist:
            raise serializers.ValidationError(
                {"detail": "The Student role is not configured. Seed the ROLES table."}
            )

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=role,
            status="Active",
            # Cannot log in until the confirmation link is used.
            email_verified=False,
        )
        # An empty profile now, so onboarding only ever updates an existing row.
        UserProfile.objects.create(user=user)
        return user


class ActivateAccountSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={"invalid": "Please enter a valid email address, like juan@gmail.com."}
    )


class PasswordResetLinkSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class PasswordResetConfirmSerializer(PasswordResetLinkSerializer):
    new_password = serializers.CharField(write_only=True, error_messages={"blank": "Please choose a new password."})
    confirm_new_password = serializers.CharField(
        write_only=True, error_messages={"blank": "Please type your new password again."}
    )


class ResendActivationSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={"invalid": "Please enter a valid email address, like juan@gmail.com."}
    )


# Onboarding: one serializer per wizard step, saved as the student presses Continue.


class OnboardingNameSerializer(serializers.Serializer):
    first_name = serializers.CharField(
        max_length=150, error_messages={"blank": "Please enter your first name."}
    )
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(
        max_length=150, error_messages={"blank": "Please enter your last name."}
    )

    def save(self, user):
        data = self.validated_data
        user.first_name = data["first_name"].strip()
        user.last_name = data["last_name"].strip()
        user.save(update_fields=["first_name", "last_name"])
        profile = user.user_profile
        profile.middle_name = (data.get("middle_name") or "").strip() or None
        profile.save(update_fields=["middle_name", "updated_at"])


class OnboardingAcademicSerializer(serializers.Serializer):
    school_id_number = serializers.CharField(
        max_length=50, error_messages={"blank": "Please enter your School ID number."}
    )
    course = serializers.CharField(max_length=150, error_messages={"blank": "Please choose your course."})
    academic_status = serializers.ListField(
        child=serializers.ChoiceField(
            choices=ACADEMIC_STATUS_OPTIONS,
            error_messages={"invalid_choice": "Please choose from the options listed."},
        ),
        allow_empty=False,
        error_messages={
            "empty": "Please tick at least one that describes you.",
            "not_a_list": "Please tick at least one that describes you.",
        },
    )
    last_semester_attended = serializers.CharField(
        max_length=40, error_messages={"blank": "Please enter the last semester you attended."}
    )
    graduation_date = serializers.DateField(
        required=False, allow_null=True, error_messages={"invalid": "Please enter a valid date."}
    )

    def validate_school_id_number(self, value):
        value = value.strip()
        user = self.context["user"]
        if UserProfile.objects.exclude(user=user).filter(school_id_number__iexact=value).exists():
            # Point at Window 6: the likeliest story is a mistyped ID, or a real one used by someone else.
            raise serializers.ValidationError(
                "This School ID number is already linked to another account. "
                "Check it for typos, or ask at Window 6 if it's yours."
            )
        return value

    def validate_academic_status(self, value):
        return ordered_statuses(value)

    def validate_last_semester_attended(self, value):
        return _validated_semester(value)

    def validate(self, attrs):
        if is_alumnus(attrs["academic_status"]):
            graduated = attrs.get("graduation_date")
            if not graduated:
                raise serializers.ValidationError({"graduation_date": "Please enter your graduation date."})
            if graduated > timezone.localdate():
                raise serializers.ValidationError({"graduation_date": "Your graduation date can't be in the future."})
        else:
            attrs["graduation_date"] = None
        return attrs

    @transaction.atomic
    def save(self, user):
        data = self.validated_data
        profile = user.user_profile
        profile.school_id_number = data["school_id_number"]
        profile.course = data["course"].strip()
        profile.academic_status = data["academic_status"]
        profile.last_semester_attended = data["last_semester_attended"]
        profile.graduation_date = data.get("graduation_date")
        profile.save(
            update_fields=[
                "school_id_number", "course", "academic_status",
                "last_semester_attended", "graduation_date", "updated_at",
            ]
        )
        # The app routes on role: anyone still enrolled is a Student, even an alumnus now in grad school.
        role_name = Role.RoleName.STUDENT if is_student(data["academic_status"]) else Role.RoleName.ALUMNI
        role = Role.objects.filter(role_name=role_name).first()
        if role and user.role_id != role.id:
            user.role = role
            user.save(update_fields=["role"])


PH_MOBILE_DIGITS = re.compile(r"^\+?\d{10,13}$")


class OnboardingContactSerializer(serializers.Serializer):
    birth_date = serializers.DateField(error_messages={"invalid": "Please enter a valid date."})
    contact_number = serializers.CharField(
        max_length=20, error_messages={"blank": "Please enter your mobile number."}
    )

    def validate_birth_date(self, value):
        if value >= date.today():
            raise serializers.ValidationError("Your birth date has to be in the past.")
        if value.year < 1900:
            raise serializers.ValidationError("Please check the year of your birth date.")
        return value

    def validate_contact_number(self, value):
        compact = re.sub(r"[\s()-]", "", value)
        if not PH_MOBILE_DIGITS.match(compact):
            raise serializers.ValidationError("Please enter a valid mobile number, like 09171234567.")
        return compact

    def save(self, user):
        data = self.validated_data
        user.contact_number = data["contact_number"]
        user.save(update_fields=["contact_number"])
        profile = user.user_profile
        profile.birth_date = data["birth_date"]
        profile.save(update_fields=["birth_date", "updated_at"])


ONBOARDING_STEPS = {
    "name": OnboardingNameSerializer,
    "academic": OnboardingAcademicSerializer,
    "contact": OnboardingContactSerializer,
}
