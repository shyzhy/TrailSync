from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import FormRequest, Role, User, UserProfile


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
