import json
import uuid
from datetime import date, datetime

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import (
    FormRequest,
    FormSubmission,
    ReleaseSchedule,
    ReleaseSlot,
    RequestProxy,
    RequirementVerification,
    Role,
    StaffProfile,
    TransactionType,
    User,
    UserProfile,
)


def build_profile_payload(user):
    """Same {student profile} / {staff profile} shape LoginView returns,
    reused by /api/me/ so a page reload sees exactly what login saw."""
    if hasattr(user, "user_profile"):
        p = user.user_profile
        return {
            "school_id_number": p.school_id_number,
            "first_name": user.first_name,
            "middle_name": p.middle_name,
            "last_name": user.last_name,
            "course": p.course,
            "year_level": p.year_level,
            "user_category": p.user_category,
        }
    if hasattr(user, "staff_profile"):
        s = user.staff_profile
        return {
            "employee_id": s.employee_id,
            "assigned_window": s.assigned_window,
            "position": s.position,
        }
    return None


class MeSerializer(serializers.Serializer):
    """Read-only 'who am I' payload for GET /api/me/."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    contact_number = serializers.CharField(allow_null=True)
    role = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    def get_role(self, user):
        return user.role.role_name if user.role_id else None

    def get_profile(self, user):
        return build_profile_payload(user)


class UpdateProfileSerializer(serializers.Serializer):
    """PATCH /api/me/ body. Only the four fields a student can legitimately
    self-edit: everything else in USER_PROFILES (school ID, course, year
    level, category) is an official record that should change through the
    registrar, not a self-service form — see the Profile page's Account
    card, which renders those read-only.

    first_name/last_name live on User; middle_name lives on UserProfile;
    contact_number lives on User (not UserProfile — that's where it was
    actually modeled back when registration was built).
    """

    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

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
            profile.save(update_fields=["middle_name"])

        return user


class ChangePasswordSerializer(serializers.Serializer):
    """POST /api/me/change-password/ body. Touches USERS.password only —
    never USER_PROFILES."""

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
    """POST /api/me/change-email/request/ body. Doesn't touch USERS.email
    directly — see ChangeEmailConfirmSerializer, which does, once the link
    sent here is actually clicked."""

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
    """POST /api/me/change-email/confirm/ body — the link from the
    verification email lands here with its token."""

    token = serializers.CharField()


class TrackedFormRequestSerializer(serializers.ModelSerializer):
    """GET /api/form-requests/ row shape — everything the Track Requests
    ticket card and its detail expansion need. purpose/number_of_copies/
    semester/additional_notes/graduation_date all live inside
    FormSubmission.form_data (see that model's docstring), so they're pulled
    out here rather than being real columns.

    Read-only, student-facing view. amount_due/payment_date are safe to
    expose (students may see what they owe and when they paid), but
    clearance_check_result, clearance_checked_by, duplicate_flag, and
    or_number are deliberately absent — those are staff/system-set fields
    per the ERD update and must never reach a student-facing response, let
    alone be writable here. This serializer has no write path at all
    (ModelSerializer is only ever constructed with an instance, never
    `data=`, for this view's GET), so there's no separate step needed to
    keep them non-editable.

    verification_remarks stays null — no REQUIREMENT_VERIFICATIONS table
    exists yet. release_schedule now merges the real ReleaseSchedule claim
    record (claimed_at/claimant_name) with the ReleaseSlot window
    (slot_date/start_time/end_time) when either exists.
    """

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
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

    class Meta:
        model = FormRequest
        fields = [
            "id",
            "request_code",
            "request_status",
            "transaction_type",
            "created_at",
            "requires_archive_retrieval",
            "purpose",
            "purpose_other",
            "number_of_copies",
            "semester",
            "additional_notes",
            "graduation_date",
            "proxy",
            "verification_remarks",
            "release_schedule",
            # Safe for a student to read about their own request; everything
            # else new on FormRequest (clearance_*, or_number,
            # duplicate_flag) is intentionally NOT listed here.
            "amount_due",
            "payment_date",
            # Whether the printable Cashier form can be generated yet. The
            # API decides this, not the UI - the Download Receipt button and
            # the receipt endpoint's own gate then agree by construction,
            # instead of the frontend keeping a second copy of the status
            # list that could drift out of sync with the backend's.
            "receipt_available",
            # Whether the downloadable claim stub is live. Switched on when
            # staff logs the Cashier payment, so from Processing onward the
            # student has something to present at Window 6.
            "digital_stub_active",
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
        # RequirementVerification is a history of events (a request can be
        # rejected, revised, and re-verified) — the most recent one is "the"
        # current verification, per the model's default ordering.
        latest = obj.verifications.first()
        return latest.remarks if latest else None

    def get_receipt_available(self, obj):
        return obj.receipt_available()

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
        return data


class RegistrarRecentSubmissionSerializer(serializers.ModelSerializer):
    """GET /api/registrar/dashboard/recent-submissions/ row shape.

    student_first_name/student_last_name come from User, not UserProfile —
    same convention as everywhere else in this codebase (names live on the
    auth user, only middle_name lives on the profile). The frontend derives
    the avatar initial from these itself, the same way it already does for
    the sidebar footer, rather than duplicating that logic server-side.
    """

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)

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
        ]


class RegistrarReleaseSlotRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/dashboard/todays-release-slots/ row shape.

    No dedicated release_status field exists (RELEASE_SCHEDULES, as actually
    built, is a post-hoc claim record with no status of its own) — the
    frontend derives Waiting/Claimed from request_status the same way
    TicketCard already derives its progress-dot state from it, rather than
    this serializer inventing a second status vocabulary.
    """

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
        ]

    def get_start_time(self, obj):
        return obj.release_slot.start_time.isoformat(timespec="minutes") if obj.release_slot else None


class RegistrarQueueRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/queue/ row shape — doubles as the Request Details
    panel's data too, since the frontend already has this row in memory the
    moment a request is selected and a second detail fetch would just be a
    round trip for data it's already holding.

    requirements_status ("Complete"/"Incomplete") is a narrow, honest proxy:
    the ERD has no per-document checklist (no SUBMISSION_ATTACHMENTS table),
    so the only thing actually verifiable is whether the one real upload
    this system has — board_exam_photo — is present when the purpose
    requires it. Every other purpose has nothing to check against and reads
    as Complete. See chat for the SUBMISSION_ATTACHMENTS question.
    """

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)
    student_school_id_number = serializers.SerializerMethodField()
    student_course = serializers.SerializerMethodField()
    student_year_level = serializers.SerializerMethodField()
    purpose = serializers.SerializerMethodField()
    purpose_other = serializers.SerializerMethodField()
    number_of_copies = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    additional_notes = serializers.SerializerMethodField()
    requirements_status = serializers.SerializerMethodField()
    uploaded_files = serializers.SerializerMethodField()
    verification_remarks = serializers.SerializerMethodField()
    proxy = serializers.SerializerMethodField()
    student_full_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
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
            "student_year_level",
            "purpose",
            "purpose_other",
            "number_of_copies",
            "semester",
            "additional_notes",
            "requirements_status",
            "uploaded_files",
            "verification_remarks",
            "proxy",
            "student_full_name",
            # Lifecycle state the review page renders and gates its actions
            # on: what is owed, what was paid, who approved it, and how it
            # was eventually claimed.
            "is_rush",
            "amount_due",
            "or_number",
            "payment_date",
            "approved_by_name",
            "registrar_approved_at",
            "release_schedule",
        ]

    def _profile(self, obj):
        return getattr(obj.user, "user_profile", None)

    def get_student_school_id_number(self, obj):
        p = self._profile(obj)
        return p.school_id_number if p else None

    def get_student_course(self, obj):
        p = self._profile(obj)
        return p.course if p else None

    def get_student_year_level(self, obj):
        p = self._profile(obj)
        return p.year_level if p else None

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
        submission = getattr(obj, "submission", None)
        if self._form_data(obj).get("purpose") == FormSubmission.Purpose.BOARD_EXAM:
            has_photo = bool(submission and submission.board_exam_photo)
            return "Complete" if has_photo else "Incomplete"
        return "Complete"

    def get_uploaded_files(self, obj):
        """The one real uploaded file this system tracks. Not a general
        attachment list — see the class docstring and the chat note about
        SUBMISSION_ATTACHMENTS not existing yet."""
        submission = getattr(obj, "submission", None)
        if not (submission and submission.board_exam_photo):
            return []
        f = submission.board_exam_photo
        try:
            size = f.size
        except (FileNotFoundError, ValueError):
            size = None
        return [
            {
                "file_name": f.name.rsplit("/", 1)[-1],
                "file_url": f.url,
                "file_size": size,
                "kind": "board_exam_photo",
            }
        ]

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
        """Pre-fills the Claimant Name field on the Release action, which is
        the student themselves unless a proxy is collecting."""
        p = self._profile(obj)
        parts = [obj.user.first_name or ""]
        if p is not None and p.middle_name:
            parts.append(p.middle_name)
        parts.append(obj.user.last_name or "")
        return " ".join(x for x in parts if x).strip() or obj.user.email

    def get_approved_by_name(self, obj):
        approver = obj.registrar_approved_by
        return approver.user.get_full_name() if approver else None

    def get_release_schedule(self, obj):
        """The booked window merged with the claim record, if either exists.

        Staff confirm the date/time here before notifying the student that a
        document is ready, so an unscheduled request has to be visibly
        unscheduled rather than silently absent.
        """
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
                    # What Mark Ready to Release actually stored. The review
                    # page pre-fills its date/time/slot inputs from these so
                    # staff adjust an existing booking rather than retyping
                    # one that is already on file.
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
    """Payload for logging a Cashier payment (Approved -> Processing).

    Both fields are required and neither is inferred from the printed PDF:
    the form's Cashier box is filled in by hand on paper, and this is the
    separate digital capture of what was written there.
    """

    or_number = serializers.CharField(max_length=50, allow_blank=False, trim_whitespace=True)
    payment_date = serializers.DateField()


class MarkReadySerializer(serializers.Serializer):
    """Payload for Mark Ready to Release.

    Staff set the handover time here rather than the step only reading a
    value booked earlier. Two paths, deliberately allowed to coexist:

      - release_slot chosen -> date and time are taken FROM that slot, so a
        staff member cannot save a time that contradicts the window they
        picked. That request then counts against the slot's capacity.
      - no slot -> release_date and release_time_start are taken as typed,
        and the booking consumes no slot capacity.

    release_date is required either way: the whole point of the amendment is
    that "Ready for Pickup" now always carries a date the student can be
    told, so there is no path here that leaves one unset.
    """

    release_date = serializers.DateField()
    release_time_start = serializers.TimeField(required=False, allow_null=True)
    release_slot = serializers.PrimaryKeyRelatedField(
        queryset=ReleaseSlot.objects.all(), required=False, allow_null=True
    )

    def validate(self, attrs):
        slot = attrs.get("release_slot")
        if slot is not None:
            # The slot is the authority on its own timing; whatever the date
            # picker sent is overwritten rather than trusted, so the two can
            # never disagree in the stored row.
            attrs["release_date"] = slot.slot_date
            attrs["release_time_start"] = slot.start_time
        return attrs


class ReleaseRequestSerializer(serializers.Serializer):
    """Payload for the terminal Release action.

    proxy_acknowledged is only meaningful when the request has a
    RequestProxy; the view enforces that, since whether it is required
    depends on the instance rather than the payload.
    """

    claimant_name = serializers.CharField(max_length=150, allow_blank=False, trim_whitespace=True)
    proxy_acknowledged = serializers.BooleanField(required=False, default=False)


class VerifyRequestSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True)


class RejectRequestSerializer(serializers.Serializer):
    # Reject explicitly requires remarks — the button is disabled client-side
    # until this is filled in, but the API enforces it too rather than
    # trusting the frontend.
    remarks = serializers.CharField(allow_blank=False, error_messages={"blank": "Review remarks are required to reject a request."})


class ReleaseSlotDetailSerializer(serializers.ModelSerializer):
    """GET /api/registrar/release-slots/?date=... row shape.

    available_slots practically means "total capacity" now, not "remaining"
    — see the model docstring update. assigned/remaining are computed live
    from FormRequest.release_slot here rather than trusted from a
    decrementing counter, since nothing has decremented this field since the
    Request Form wizard stopped asking students to pick a slot at submission.
    """

    assigned_count = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    assignments = serializers.SerializerMethodField()

    class Meta:
        model = ReleaseSlot
        fields = ["id", "slot_date", "start_time", "end_time", "available_slots", "assigned_count", "remaining", "assignments"]

    def get_assigned_count(self, obj):
        return obj.form_requests.count()

    def get_remaining(self, obj):
        return max(obj.available_slots - obj.form_requests.count(), 0)

    def get_assignments(self, obj):
        rows = []
        for fr in obj.form_requests.select_related("transaction_type", "user", "release_schedule"):
            schedule = getattr(fr, "release_schedule", None)
            # Prefer the stored release_status now that ReleaseSchedule has
            # one; fall back to the old claimed_at derivation for rows
            # written before that column existed, which the migration only
            # backfilled where a claim timestamp was actually present.
            if schedule is not None and schedule.release_status:
                claimed = schedule.release_status == "Claimed"
            else:
                claimed = bool(schedule and schedule.claimed_at)
            rows.append(
                {
                    "form_request_id": fr.id,
                    "request_code": fr.request_code,
                    "student_first_name": fr.user.first_name,
                    "student_last_name": fr.user.last_name,
                    "transaction_type": fr.transaction_type.name,
                    "status": "Claimed" if claimed else "Scheduled",
                }
            )
        return rows


class CreateReleaseSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReleaseSlot
        fields = ["slot_date", "start_time", "end_time", "available_slots"]


class AssignableRequestSerializer(serializers.ModelSerializer):
    """GET /api/registrar/release-slots/assignable-requests/ — the picker's
    options. Includes requests already assigned to A slot (with which one
    flagged), not just unassigned ones, so reassigning a request from one
    slot to another is just picking it again from a different slot's
    Assign button — no separate "reassign" flow needed.
    """

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)
    student_first_name = serializers.CharField(source="user.first_name", read_only=True)
    student_last_name = serializers.CharField(source="user.last_name", read_only=True)
    current_slot_id = serializers.IntegerField(source="release_slot_id", read_only=True)

    class Meta:
        model = FormRequest
        fields = ["id", "request_code", "transaction_type", "student_first_name", "student_last_name", "current_slot_id"]


class AssignSlotSerializer(serializers.Serializer):
    form_request = serializers.PrimaryKeyRelatedField(
        # Schedulable from the moment payment is logged. Staff confirm the
        # booked window as part of Mark Ready to Release, so requiring Ready
        # first would mean nothing could ever be scheduled before the point
        # the schedule is needed.
        queryset=FormRequest.objects.filter(
            request_status__in=[
                FormRequest.RequestStatus.PROCESSING,
                FormRequest.RequestStatus.READY,
            ]
        )
    )


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
            "common_purposes",
            "special_notes",
        ]


class ReleaseSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReleaseSlot
        fields = ["id", "slot_date", "start_time", "end_time", "available_slots"]


class FormRequestResultSerializer(serializers.ModelSerializer):
    """The response shape after a successful submission — just enough for
    the confirmation screen ("Your request W6-0XX has been submitted!")."""

    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)

    class Meta:
        model = FormRequest
        fields = ["id", "request_code", "request_status", "transaction_type", "created_at"]


def _generate_request_code():
    """W6-0XX, unique. Collisions are only realistically possible under
    concurrent submissions at the same instant, which a single registrar
    window won't see in practice — the retry loop exists as a safety net,
    not because this is expected to fire."""
    for _ in range(5):
        candidate = f"W6-{FormRequest.objects.count() + 1:03d}"
        if not FormRequest.objects.filter(request_code=candidate).exists():
            return candidate
    return f"W6-{uuid.uuid4().hex[:8].upper()}"


def _parse_json_object(raw, field_name):
    """form_data and proxy always arrive as a JSON-encoded string — the
    request is always multipart (a file may be attached), and multipart
    fields are strings by construction, never nested objects."""
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


class CreateFormRequestSerializer(serializers.Serializer):
    """POST /api/form-requests/ body (always multipart/form-data, since a
    file may be attached even though most submissions carry none).

    user is deliberately not a field here — it always comes from
    request.user in the view/create(), never the payload, so a request can
    only ever be filed under the account making it.

    form_data/proxy are opaque JSON blobs by design (see FormSubmission's
    docstring) — validate() below is where their actual required fields are
    enforced, since a flat serializer field can't reach inside them.
    """

    transaction_type = serializers.PrimaryKeyRelatedField(queryset=TransactionType.objects.all())
    form_data = serializers.CharField()
    proxy = serializers.CharField(required=False, allow_blank=True)
    board_exam_photo = serializers.FileField(required=False)

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
        is_alumni = bool(profile and profile.user_category == "Alumni")

        purpose = (form_data.get("purpose") or "").strip()
        if not purpose:
            errors.setdefault("form_data", {})["purpose"] = "Please select a purpose."
        elif purpose not in FormSubmission.Purpose.values:
            errors.setdefault("form_data", {})["purpose"] = "Please select a valid purpose."
        if purpose == FormSubmission.Purpose.OTHER and not (form_data.get("purpose_other") or "").strip():
            errors.setdefault("form_data", {})["purpose_other"] = "Please specify your purpose."

        try:
            copies = int(form_data.get("number_of_copies", 0))
        except (TypeError, ValueError):
            copies = 0
        if copies < 1:
            errors.setdefault("form_data", {})["number_of_copies"] = "Enter at least 1 copy."

        if not (form_data.get("semester") or "").strip():
            errors.setdefault("form_data", {})["semester"] = "Please select a semester / academic year."

        # Alumni-only question; current students never see or answer it.
        graduation_date = None
        if is_alumni:
            raw_grad_date = (form_data.get("graduation_date") or "").strip()
            graduation_date = _parse_iso_date(raw_grad_date)
            if graduation_date is None:
                errors.setdefault("form_data", {})["graduation_date"] = "Please enter your graduation date."

        # System-enforced, not a dismissible warning: Board Exam requests
        # cannot proceed without the photo actually attached.
        if purpose == FormSubmission.Purpose.BOARD_EXAM and not attrs.get("board_exam_photo"):
            errors.setdefault("form_data", {})[
                "board_exam_photo"
            ] = "Please upload a white-background 2x2 photo for this request."

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

        attrs["_is_alumni"] = is_alumni
        attrs["_graduation_date"] = graduation_date
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        form_data = validated_data["form_data"]
        graduation_date = validated_data["_graduation_date"]

        # Pre-2018 grads may need records pulled from the archive — derived
        # from the date they actually gave us, not a separate direct question.
        requires_archive = bool(graduation_date and graduation_date < date(2018, 1, 1))

        form_request = FormRequest.objects.create(
            user=user,
            transaction_type=validated_data["transaction_type"],
            request_code=_generate_request_code(),
            requires_archive_retrieval=requires_archive,
        )
        FormSubmission.objects.create(
            form_request=form_request,
            form_data=form_data,
            board_exam_photo=validated_data.get("board_exam_photo"),
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
    """Student / alumni self-registration.

    Staff never come through here: their accounts are provisioned by an admin
    and gated on StaffProfile.approval_status, so this endpoint only ever
    assigns the Student or Alumni role and activates the account immediately.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    school_id_number = serializers.CharField(max_length=50)
    first_name = serializers.CharField(max_length=150)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150)

    course = serializers.CharField(max_length=150)
    year_level = serializers.CharField(max_length=50, required=False, allow_blank=True)
    user_category = serializers.ChoiceField(
        choices=UserProfile._meta.get_field("user_category").choices
    )

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate_school_id_number(self, value):
        value = value.strip()
        if UserProfile.objects.filter(school_id_number__iexact=value).exists():
            raise serializers.ValidationError("This School ID Number is already registered.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})

        # Year level is meaningless for alumni, so only students must supply it.
        if attrs.get("user_category") == "Student" and not (attrs.get("year_level") or "").strip():
            raise serializers.ValidationError({"year_level": "Year level is required for students."})

        # Run Django's configured AUTH_PASSWORD_VALIDATORS. Passing an unsaved
        # User lets UserAttributeSimilarityValidator compare against the email
        # and name too. Django raises its own ValidationError, which DRF does
        # not translate, so re-raise it keyed to the password field.
        probe = User(
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            validate_password(attrs["password"], probe)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("confirm_password", None)
        category = validated_data["user_category"]

        # Look the role up by name rather than hardcoding a PK - the Role rows
        # are reference data and their IDs are not guaranteed across databases.
        try:
            role = Role.objects.get(role_name=category)
        except Role.DoesNotExist:
            raise serializers.ValidationError(
                {"user_category": f"The '{category}' role is not configured. Seed the ROLES table."}
            )

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"].strip(),
            last_name=validated_data["last_name"].strip(),
            role=role,
            status="Active",  # students/alumni need no approval step
        )

        UserProfile.objects.create(
            user=user,
            school_id_number=validated_data["school_id_number"],
            middle_name=(validated_data.get("middle_name") or "").strip(),
            course=validated_data["course"].strip(),
            year_level=(validated_data.get("year_level") or "").strip(),
            user_category=category,
        )

        return user
