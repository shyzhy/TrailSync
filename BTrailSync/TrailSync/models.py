from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models

class Role(models.Model):
    class RoleName(models.TextChoices):
        STUDENT = "Student", "Student"
        ALUMNI = "Alumni", "Alumni"
        REGISTRAR = "Registrar Staff", "Registrar Staff"
        ADMIN = "Admin", "Admin"

    role_name = models.CharField(max_length=50, choices=RoleName.choices, unique=True)
    description = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.role_name

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", "Active")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None

    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="users",
        blank=True,
        null=True,
    )

    email = models.EmailField(unique=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ("Active", "Active"),
            ("Suspended", "Suspended"),
        ],
        default="Active",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.email} - {self.get_full_name()}"

class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_profile",
    )

    school_id_number = models.CharField(max_length=50, unique=True)

    # first_name / last_name live on User (AbstractUser); only the middle name
    # is profile-side, so registration has somewhere to put it.
    middle_name = models.CharField(max_length=150, blank=True, null=True)

    course = models.CharField(max_length=150, blank=True, null=True)
    college = models.CharField(max_length=150, blank=True, null=True)
    year_level = models.CharField(max_length=50, blank=True, null=True)

    user_category = models.CharField(
        max_length=50,
        choices=[
            ("Student", "Student"),
            ("Alumni", "Alumni"),
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.user_category}"

class StaffProfile(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "Pending", "Pending"
        APPROVED = "Approved", "Approved"
        REJECTED = "Rejected", "Rejected"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
    )

    employee_id = models.CharField(max_length=50, unique=True)
    assigned_window = models.CharField(max_length=50, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)

    availability_status = models.CharField(
        max_length=30,
        choices=[
            ("Available", "Available"),
            ("Unavailable", "Unavailable"),
        ],
        default="Available",
    )

    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_staff_profiles",
        blank=True,
        null=True,
    )
    approved_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name()}"


class TransactionType(models.Model):
    """A requestable document, e.g. Transcript of Records, Certificate of Enrollment."""

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)

    # Shown on the Request a Form page as "You'll need: ..." once a document
    # type is picked, so students know what to prepare before they submit.
    required_documents = models.TextField(blank=True, null=True)
    # Both optional/informational — left blank where a document type has no
    # fixed fee or published turnaround.
    processing_time = models.CharField(max_length=100, blank=True, null=True)
    fee_amount = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ReleaseSlot(models.Model):
    """A bookable release-day window at Window 6, with a fixed remaining
    capacity — students choose one of these rather than an arbitrary date.
    """

    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    available_slots = models.PositiveIntegerField(help_text="Remaining capacity for this window.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slot_date", "start_time"]

    def __str__(self):
        return f"{self.slot_date} {self.start_time}–{self.end_time} ({self.available_slots} left)"


class FormRequest(models.Model):
    """A student/alumni's request for one document, tracked through to release."""

    class RequestStatus(models.TextChoices):
        SUBMITTED = "Submitted", "Submitted"
        VERIFIED = "Verified", "Verified"
        READY = "Ready", "Ready for Pickup"
        RELEASED = "Released", "Released"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="form_requests",
    )
    transaction_type = models.ForeignKey(
        TransactionType,
        on_delete=models.PROTECT,
        related_name="form_requests",
    )
    # Which release window this request is booked against. PROTECT: a slot
    # that already has requests against it shouldn't be deletable out from
    # under them.
    release_slot = models.ForeignKey(
        ReleaseSlot,
        on_delete=models.PROTECT,
        related_name="form_requests",
        null=True,
        blank=True,
    )
    request_code = models.CharField(max_length=30, unique=True)
    request_status = models.CharField(
        max_length=20,
        choices=RequestStatus.choices,
        default=RequestStatus.SUBMITTED,
    )
    # Only meaningful for alumni requesting a pre-2018 record; the form only
    # asks the question for that audience and defaults it False otherwise.
    requires_archive_retrieval = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.request_code} - {self.user.email}"


class FormSubmission(models.Model):
    """The student-supplied details for one FormRequest: copies + purpose.

    One-to-one because this is the *content* of a single request, not a
    repeatable line item — a student wanting two different purposes files
    two separate FormRequests.
    """

    class Purpose(models.TextChoices):
        EMPLOYMENT = "Employment", "Employment"
        FURTHER_STUDIES = "Further studies", "Further studies"
        SCHOLARSHIP = "Scholarship", "Scholarship"
        OTHER = "Other", "Other"

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="submission",
    )
    number_of_copies = models.PositiveIntegerField(default=1)
    purpose = models.CharField(max_length=30, choices=Purpose.choices)
    # Required (validated at the serializer level) only when purpose="Other".
    purpose_other = models.CharField(max_length=255, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission for {self.form_request.request_code}"
