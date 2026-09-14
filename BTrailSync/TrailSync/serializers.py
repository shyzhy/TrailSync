import json
import re
import uuid
from datetime import date, datetime
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

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
    """Absolute URL for a stored file, or None when there is no file.

    Every media URL the API returns goes through here. A relative "/media/..."
    is useless to the browser, because the frontend is a different origin and
    resolves it against the Vite server - which returns the app shell with a
    200 rather than the file. This is what the frontend is meant to use as-is,
    so it never has to assemble a file path itself.
    """
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    return urljoin(settings.BACKEND_BASE_URL.rstrip("/") + "/", url.lstrip("/"))


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
            # Absolute, and the only avatar URL the frontend should use. null
            # means "no photo, show initials" - the one fallback everywhere.
            "profile_picture_url": absolute_media_url(p.profile_picture),
            "tour_completed_at": p.tour_completed_at.isoformat() if p.tour_completed_at else None,
            "academic_level": p.academic_level,
            "graduation_date": p.graduation_date.isoformat() if p.graduation_date else None,
            "birth_date": p.birth_date.isoformat() if p.birth_date else None,
            # Computed from the fields above on every read - never a stored
            # flag that could drift from them. academic_locked: once any
            # request exists, the ID/course/category it was filed under can
            # only be changed at Window 6, not from the wizard.
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
    """One row of a student's notification inbox. Read-only: the only change
    a student can make is marking it read, which has its own endpoint."""

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
    number_of_pages = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    additional_notes = serializers.SerializerMethodField()
    graduation_date = serializers.SerializerMethodField()
    proxy = serializers.SerializerMethodField()
    verification_remarks = serializers.SerializerMethodField()
    release_schedule = serializers.SerializerMethodField()
    receipt_available = serializers.SerializerMethodField()
    uploaded_files = serializers.SerializerMethodField()

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
            "number_of_pages",
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
            # Read-only here. The only write path for attachments is the
            # student's own submission (see CreateFormRequestSerializer);
            # this serializer has no write path at all.
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

    def get_number_of_pages(self, obj):
        return self._form_data(obj).get("number_of_pages")

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
        # The pickup date as staff actually set it. Without this, a release
        # scheduled at a freeform time (no slot) never reached the student,
        # whose ticket then said "Window 6 will confirm your date soon" about
        # a date that had already been set. scheduled_release() is the one
        # accessor that knows the precedence between the two sources.
        when = obj.scheduled_release()
        if when is not None:
            data["release_date"] = when[0].isoformat()
            data["release_time_start"] = when[1].isoformat(timespec="minutes") if when[1] else None
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
    """GET /api/registrar/dashboard/todays-pickups/ row shape.

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
        # Reads the schedule (via scheduled_release, which also covers
        # requests still carrying an old slot) rather than ReleaseSlot: the
        # slot picker is gone, so nothing new ever has one.
        when = obj.scheduled_release()
        start = when[1] if when else None
        return start.isoformat(timespec="minutes") if start else None


class RegistrarReleasedRowSerializer(serializers.ModelSerializer):
    """GET /api/registrar/released/ row shape - the Released Documents table.

    Deliberately narrower than the .xlsx export (see exports.COLUMNS): the
    screen answers "was this collected, by whom, and what was paid", while
    the office's sheet also carries eligibility and turnaround columns that
    are only read when the record is filed.
    """

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
        """Whether an authorised proxy was on file for this request.

        The claimant name alone cannot answer this: staff type whoever
        actually collected the document, which may or may not match the
        registered proxy. Shown so a record can be read without opening the
        request.
        """
        return getattr(obj, "proxy", None) is not None


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
    attachment_count = serializers.SerializerMethodField()
    verification_remarks = serializers.SerializerMethodField()
    proxy = serializers.SerializerMethodField()
    student_full_name = serializers.SerializerMethodField()
    number_of_pages = serializers.SerializerMethodField()
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
            "student_year_level",
            "purpose",
            "purpose_other",
            "number_of_copies",
            "number_of_pages",
            "submission_extras",
            "semester",
            "additional_notes",
            "requirements_status",
            "uploaded_files",
            "attachment_count",
            "verification_remarks",
            "proxy",
            "student_full_name",
            # Lifecycle state the review page renders and gates its actions
            # on: what is owed, what was paid, who approved it, and how it
            # was eventually claimed.
            "is_rush",
            # Staff-facing fraud signal. This serializer only ever reaches
            # registrar endpoints; the student serializer omits it.
            "duplicate_flag",
            "amount_due",
            "or_number",
            "payment_date",
            "approved_by_name",
            "verified_by_name",
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
        """Still the narrow, checkable rule: a Board Exam request needs its
        2x2 photo.

        Deliberately NOT widened to "has the student attached anything" now
        that attachments exist. TransactionType.required_documents is free
        text with no structured mapping to uploaded files, so there is no way
        to tell whether the right documents arrived - only how many did. A
        presence check would also retroactively mark every request filed
        before this table existed as Incomplete, which is a verdict the
        system cannot actually support. attachment_count carries the real
        number so staff can judge for themselves.
        """
        submission = getattr(obj, "submission", None)
        if self._form_data(obj).get("purpose") == FormSubmission.Purpose.BOARD_EXAM:
            return "Complete" if (submission and submission.board_exam_photo) else "Incomplete"
        return "Complete"

    def get_attachment_count(self, obj):
        submission = getattr(obj, "submission", None)
        return submission.attachments.count() if submission else 0

    def get_uploaded_files(self, obj):
        """Every file the student uploaded with this request.

        A real list now that SUBMISSION_ATTACHMENTS exists; until it did,
        this could only ever return the single board_exam_photo column.
        """
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
        """Pre-fills the Claimant Name field on the Release action, which is
        the student themselves unless a proxy is collecting."""
        p = self._profile(obj)
        parts = [obj.user.first_name or ""]
        if p is not None and p.middle_name:
            parts.append(p.middle_name)
        parts.append(obj.user.last_name or "")
        return " ".join(x for x in parts if x).strip() or obj.user.email

    def get_number_of_pages(self, obj):
        return self._form_data(obj).get("number_of_pages")

    def get_submission_extras(self, obj):
        """Conditional answers that only some document types or purposes ask
        for. Returned as a flat label/value list so the review page can render
        whatever is present without knowing what each document type requires.
        """
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
        """Who signed the Front Desk line. Read from the verification event
        rather than the request row, which only records the Registrar."""
        latest = obj.verifications.filter(verification_status="Verified").first()
        return latest.verified_by.user.get_full_name() if (latest and latest.verified_by) else None

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
    """Payload for Mark Ready to Release: one date, nothing else.

    This used to accept a release_slot and a freeform time as well, with the
    slot overriding both. Window 6 releases documents from 3:00 to 5:00 PM
    and has no other windows to choose between, so the picker asked staff to
    decide something that was never theirs to decide. The time now comes
    from models.RELEASE_TIME_START, and ReleaseSlot is no longer written by
    this path at all.
    """

    release_date = serializers.DateField()


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


# Bounds on the student-uploaded requirements list. Not in the brief, but an
# unbounded multi-file endpoint is a denial-of-service hole: without them one
# request could fill the disk. Sized for what the form actually asks for -
# a handful of scans - rather than as a hard policy.
# Sub-selections that live inside a single document type on the real form
# rather than being types of their own. They are submission detail, so they
# are stored in FormSubmission.form_data rather than earning columns.
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

MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
BOARD_EXAM_PHOTO_BYTES = 5 * 1024 * 1024

# Label -> the bytes a real file of that kind starts with. The file's own
# name and Content-Type come from the uploader and prove nothing; its first
# bytes do.
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
    """Raise a plain-language ValidationError for a wrong type or oversize file.

    Both messages say what IS accepted - the types and the actual limit - so
    the fix is obvious without guessing.
    """
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
    """The uploaded-requirements list for one request, staff and student alike.

    One function because both sides must see the same files - a student
    querying "did my upload arrive?" and staff asking "what did they send?"
    are the same question, and two implementations would eventually answer it
    differently.

    board_exam_photo is folded in here for display even though it lives in
    its own column, because to anyone reading the list it is simply another
    file the student uploaded. kind distinguishes them for callers that care.
    """
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
    """POST /api/form-requests/ body (always multipart/form-data, since a
    file may be attached even though most submissions carry none).

    user is deliberately not a field here — it always comes from
    request.user in the view/create(), never the payload, so a request can
    only ever be filed under the account making it.

    form_data/proxy are opaque JSON blobs by design (see FormSubmission's
    docstring) — validate() below is where their actual required fields are
    enforced, since a flat serializer field can't reach inside them.
    """

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
        # Checked here and not only by the file picker's accept="": the
        # endpoint can be called without the form.
        check_upload(value, BOARD_EXAM_PHOTO_TYPES, BOARD_EXAM_PHOTO_BYTES, "The 2x2 photo")
        return value

    # Attachments are NOT declared as a serializer field. They arrive as a
    # repeated multipart key, which only request.FILES.getlist can read - a
    # declared FileField would silently keep just the last one. Pulled and
    # checked in validate() instead.

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

        # The official form is printed from the profile (name, ID number,
        # course, birth date). Enforced here and not only by the frontend
        # sending people to onboarding, because this endpoint can be called
        # without the frontend.
        if profile is None or not profile.onboarding_state()["complete"]:
            raise serializers.ValidationError(
                {"detail": "Please finish setting up your profile before requesting a document."}
            )
        is_alumni = profile.user_category == "Alumni"

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

        if not (form_data.get("semester") or "").strip():
            errors.setdefault("form_data", {})["semester"] = "Please select a semester / academic year."

        # Pages only matter for documents priced by the page, and asking for
        # them elsewhere would be a question with no consequence. Enforced
        # here because the fee depends on it: a per-page document with no page
        # count would silently price as a single page.
        transaction_type = attrs["transaction_type"]
        if transaction_type.pricing_unit == "per_page":
            try:
                pages = int(form_data.get("number_of_pages", 0))
            except (TypeError, ValueError):
                pages = 0
            if pages < 1:
                errors.setdefault("form_data", {})["number_of_pages"] = (
                    f"{transaction_type.name} is charged per page. Enter the number of pages."
                )

        # The one purpose on the form carrying its own fee and its own two
        # fields.
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
        submission = FormSubmission.objects.create(
            form_request=form_request,
            form_data=form_data,
            board_exam_photo=validated_data.get("board_exam_photo"),
        )

        # Written only here, at submission time, by the student filing the
        # request. There is deliberately no staff-facing write path: staff
        # review what was uploaded, they do not upload on a student's behalf.
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
    """Student / alumni self-registration: email and password only.

    Everything else - name, school ID, course, birth date - is collected by
    the onboarding wizard after the address is confirmed (see
    OnboardingNameSerializer and friends). Spreading it out means signing up
    takes seconds, and nobody types their whole profile into an account they
    might never be able to activate.

    Staff never come through here: their accounts are provisioned by an admin
    and gated on StaffProfile.approval_status.
    """

    # Any well-formed address. There is deliberately no @ustp.edu.ph rule:
    # alumni in particular may no longer have access to a school mailbox.
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

        # Run Django's configured AUTH_PASSWORD_VALIDATORS against an unsaved
        # User, so the similarity check can compare with the email. Django
        # raises its own ValidationError, which DRF does not translate.
        try:
            validate_password(attrs["password"], User(email=attrs.get("email", "")))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # Student until onboarding says otherwise: step 2 sets the category,
        # and the role follows it (see OnboardingAcademicSerializer).
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
        # An empty profile now, so onboarding only ever updates a row that
        # exists - there is no "create or update" branch to get wrong later.
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


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------
#
# One small serializer per wizard step, each saved as the student presses
# Continue - so closing the browser halfway loses nothing, and the next
# login resumes at the first step still missing data.

ACADEMIC_LEVELS_BY_CATEGORY = {
    # The printed form's own checkbox: a current student is Undergraduate or
    # Graduate; an alumnus may also have finished at the high school level.
    "Student": {"Undergraduate", "Graduate"},
    "Alumni": {"High School", "Undergraduate", "Graduate"},
}


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
    user_category = serializers.ChoiceField(
        choices=["Student", "Alumni"],
        error_messages={"invalid_choice": "Please choose Student or Alumni."},
    )
    academic_level = serializers.ChoiceField(
        choices=["High School", "Undergraduate", "Graduate"],
        error_messages={"invalid_choice": "Please choose your academic level."},
    )
    year_level = serializers.CharField(max_length=50, required=False, allow_blank=True)
    graduation_date = serializers.DateField(
        required=False, allow_null=True, error_messages={"invalid": "Please enter a valid date."}
    )

    def validate_school_id_number(self, value):
        value = value.strip()
        user = self.context["user"]
        if UserProfile.objects.exclude(user=user).filter(school_id_number__iexact=value).exists():
            # Someone else has claimed this ID. Pointing at Window 6 rather
            # than a vague "taken" because the likeliest story is a mistyped
            # ID - or, worse, a real one used by someone else.
            raise serializers.ValidationError(
                "This School ID number is already linked to another account. "
                "Check it for typos, or ask at Window 6 if it's yours."
            )
        return value

    def validate(self, attrs):
        category = attrs["user_category"]
        if attrs["academic_level"] not in ACADEMIC_LEVELS_BY_CATEGORY[category]:
            raise serializers.ValidationError(
                {"academic_level": "High School only applies to alumni. Please choose another level."}
            )
        if category == "Student":
            if not (attrs.get("year_level") or "").strip():
                raise serializers.ValidationError({"year_level": "Please choose your year level."})
            attrs["graduation_date"] = None
        else:
            graduated = attrs.get("graduation_date")
            if not graduated:
                raise serializers.ValidationError({"graduation_date": "Please enter your graduation date."})
            if graduated > date.today():
                raise serializers.ValidationError({"graduation_date": "Your graduation date can't be in the future."})
            attrs["year_level"] = ""
        return attrs

    @transaction.atomic
    def save(self, user):
        data = self.validated_data
        profile = user.user_profile
        profile.school_id_number = data["school_id_number"]
        profile.course = data["course"].strip()
        profile.user_category = data["user_category"]
        profile.academic_level = data["academic_level"]
        profile.year_level = (data.get("year_level") or "").strip() or None
        profile.graduation_date = data.get("graduation_date")
        profile.save(
            update_fields=[
                "school_id_number", "course", "user_category", "academic_level",
                "year_level", "graduation_date", "updated_at",
            ]
        )
        # The role is what the rest of the app routes on, so it follows the
        # category the student just chose.
        role = Role.objects.filter(role_name=data["user_category"]).first()
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
