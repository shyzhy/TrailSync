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
    ReleaseSlot,
    RequestProxy,
    Role,
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

    verification/release-schedule data would come from REQUIREMENT_
    VERIFICATIONS / RELEASE_SCHEDULES tables per the original ERD — neither
    exists yet, so verification_remarks stays null and release_schedule
    falls back to the closest thing that does exist (release_slot, if one
    happens to be set) rather than being fabricated.
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
        ]

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
        # No REQUIREMENT_VERIFICATIONS table yet — always null until one exists.
        return None

    def get_release_schedule(self, obj):
        slot = obj.release_slot
        if slot is None:
            return None
        return {
            "slot_date": slot.slot_date.isoformat(),
            "start_time": slot.start_time.isoformat(timespec="minutes"),
            "end_time": slot.end_time.isoformat(timespec="minutes"),
        }


class RecentFormRequestSerializer(serializers.ModelSerializer):
    transaction_type = serializers.CharField(source="transaction_type.name", read_only=True)

    class Meta:
        model = FormRequest
        fields = ["request_code", "transaction_type", "request_status", "created_at"]


class TransactionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionType
        fields = ["id", "name", "description", "required_documents", "processing_time", "fee_amount"]


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
