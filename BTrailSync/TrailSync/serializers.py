import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import (
    FormRequest,
    FormSubmission,
    ReleaseSlot,
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
    role = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    def get_role(self, user):
        return user.role.role_name if user.role_id else None

    def get_profile(self, user):
        return build_profile_payload(user)


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


class CreateFormRequestSerializer(serializers.Serializer):
    """POST /api/form-requests/ body. user is deliberately not a field here —
    it always comes from request.user in the view/create(), never the
    payload, so a request can only ever be filed under the account making it.
    """

    transaction_type = serializers.PrimaryKeyRelatedField(queryset=TransactionType.objects.all())
    release_slot = serializers.PrimaryKeyRelatedField(queryset=ReleaseSlot.objects.all())
    number_of_copies = serializers.IntegerField(min_value=1, default=1)
    purpose = serializers.ChoiceField(choices=FormSubmission.Purpose.choices)
    purpose_other = serializers.CharField(max_length=255, required=False, allow_blank=True)
    # Only ever honored for alumni (see create()) — a current student can't
    # legitimately answer "yes" to a pre-2018-graduation question.
    requires_archive_retrieval = serializers.BooleanField(required=False, default=False)

    def validate_release_slot(self, slot):
        if slot.available_slots <= 0:
            raise serializers.ValidationError("This release slot is fully booked. Please choose another.")
        return slot

    def validate(self, attrs):
        if attrs.get("purpose") == FormSubmission.Purpose.OTHER and not (attrs.get("purpose_other") or "").strip():
            raise serializers.ValidationError({"purpose_other": "Please specify your purpose."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user

        # Lock the row and re-check capacity inside the transaction — the
        # validate_release_slot check above ran against a possibly-stale
        # read, so this is the check that actually prevents overbooking
        # under concurrent submissions for the same slot.
        slot = ReleaseSlot.objects.select_for_update().get(pk=validated_data["release_slot"].pk)
        if slot.available_slots <= 0:
            raise serializers.ValidationError(
                {"release_slot": "This release slot was just filled. Please choose another."}
            )
        slot.available_slots -= 1
        slot.save(update_fields=["available_slots"])

        profile = getattr(user, "user_profile", None)
        requires_archive = (
            bool(validated_data.get("requires_archive_retrieval"))
            if profile and profile.user_category == "Alumni"
            else False
        )

        form_request = FormRequest.objects.create(
            user=user,
            transaction_type=validated_data["transaction_type"],
            release_slot=slot,
            request_code=_generate_request_code(),
            requires_archive_retrieval=requires_archive,
        )
        FormSubmission.objects.create(
            form_request=form_request,
            number_of_copies=validated_data.get("number_of_copies", 1),
            purpose=validated_data["purpose"],
            purpose_other=(validated_data.get("purpose_other") or "").strip() or None,
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
