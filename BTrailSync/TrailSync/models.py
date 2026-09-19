import uuid
from datetime import time
from decimal import Decimal

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models
from django.utils import timezone

from .academics import is_alumnus

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
        extra_fields.setdefault("email_verified", True)
        # A superuser is the Admin portal's bootstrap account, so it gets that role unless told otherwise.
        if "role" not in extra_fields and "role_id" not in extra_fields:
            extra_fields["role"] = Role.objects.filter(role_name=Role.RoleName.ADMIN).first()

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

    # Self-registered students must confirm their address before logging in; existing users were backfilled as verified.
    email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)

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

def profile_picture_upload_to(instance, filename):
    """Random, per-upload filename: unguessable on public media URLs, and a new URL defeats caching when a photo is replaced."""
    return f"profile_pictures/{uuid.uuid4().hex}.jpg"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_profile",
    )

    # Null until onboarding; NULL rather than "" keeps the unique constraint working for many blank profiles.
    school_id_number = models.CharField(max_length=50, unique=True, null=True, blank=True)

    # first_name and last_name live on User; only the middle name is on the profile.
    middle_name = models.CharField(max_length=150, blank=True, null=True)

    # Printed on the request form; nullable because older profiles were never asked.
    birth_date = models.DateField(null=True, blank=True)

    # Every option in academics.ACADEMIC_STATUS_OPTIONS that applies; several can at once (an alumnus now in grad school).
    academic_status = models.JSONField(default=list, blank=True)
    # Typed by the student in academics.normalize_semester's format; it helps Window 6 find the records, nothing verifies it.
    last_semester_attended = models.CharField(max_length=40, blank=True, null=True)

    # When the student finished or skipped the walkthrough; stored on the account so it isn't re-offered on every device.
    tour_completed_at = models.DateTimeField(null=True, blank=True)

    # Written only through PATCH /api/me/avatar/, which validates and re-encodes the upload.
    profile_picture = models.ImageField(
        upload_to=profile_picture_upload_to,
        max_length=255,
        null=True,
        blank=True,
    )

    course = models.CharField(max_length=150, blank=True, null=True)
    college = models.CharField(max_length=150, blank=True, null=True)

    # Required whenever academic_status includes an Alumnus option.
    graduation_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name()} - {', '.join(self.academic_status or []) or 'no status yet'}"

    @property
    def is_alumnus(self):
        return is_alumnus(self.academic_status)

    def onboarding_state(self):
        """Which onboarding steps are done, computed from the data so it can never disagree with it."""
        user = self.user
        steps = {
            1: bool((user.first_name or "").strip() and (user.last_name or "").strip()),
            2: bool(
                self.school_id_number
                and self.course
                and self.academic_status
                and self.last_semester_attended
                and (self.graduation_date or not self.is_alumnus)
            ),
            3: bool(self.birth_date and (user.contact_number or "").strip()),
        }
        next_step = next((n for n, done in steps.items() if not done), None)
        return {"complete": next_step is None, "next_step": next_step, "steps_done": steps}

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

    # Staff have no UserProfile, so the middle name an admin enters lives here.
    middle_name = models.CharField(max_length=150, blank=True, null=True)
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

    @property
    def awaiting_setup(self):
        """True until the staff member has chosen a password through their setup link."""
        return not self.user.has_usable_password()

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name()}"


class TransactionType(models.Model):
    """A requestable document; the single admin-editable source for its requirements, fee and processing time."""

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    # Lets the Registrar pause a document without deleting it; the server refuses new requests for it.
    is_available = models.BooleanField(default=True)

    # Free text shown as "You'll need: ..."; the frontend splits it into a list.
    required_documents = models.TextField(blank=True, null=True)
    # Optional: blank where a document has no fixed fee or published turnaround.
    processing_time = models.CharField(max_length=100, blank=True, null=True)

    # Transcript of Records and Authentication are priced per page, a different quantity from copies.
    pricing_unit = models.CharField(
        max_length=10,
        choices=[
            ("flat", "Flat fee"),
            ("per_page", "Per page"),
        ],
        default="flat",
    )
    fee_amount = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    # Purposes this document is commonly requested for, used by the Credential Guide's filter chips.
    common_purposes = models.JSONField(default=list, blank=True)
    # Exceptional info worth flagging, e.g. the Board Exam photo requirement.
    special_notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ReleaseSlot(models.Model):
    """A legacy release-day window. Nothing books slots any more; available_slots is treated as total capacity."""

    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    available_slots = models.PositiveIntegerField(help_text="Total capacity for this window (see class docstring).")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slot_date", "start_time"]

    def __str__(self):
        return f"{self.slot_date} {self.start_time}–{self.end_time} ({self.available_slots} left)"


# Window 6 releases between 3:00 and 5:00 PM every day, so staff pick only the date.
RELEASE_TIME_START = time(15, 0)
RELEASE_TIME_END = time(17, 0)

# Add-on fees from FM-USTP-RGTR-09: two fixed line items on the printed form, so constants rather than a table.
RUSH_FEE = Decimal("100.00")
COMPLETION_OF_INC_FEE = Decimal("175.00")


class FormRequest(models.Model):
    """A student/alumni's request for one document, tracked through to release."""

    class RequestStatus(models.TextChoices):
        """The request lifecycle in order. Verified and Approved stay separate because the form carries two signatures; "blocked" is a separate axis (blocked_by_clearance).

        Rejected and Cancelled are exits rather than stages: Rejected is the Registrar's, Cancelled the student's own.
        """

        SUBMITTED = "Submitted", "Pending Verification"
        VERIFIED = "Verified", "Verified"
        APPROVED = "Approved", "Approved - Ready to Print"
        PROCESSING = "Processing", "Processing"
        READY = "Ready", "Ready for Pickup"
        RELEASED = "Released", "Released"
        REJECTED = "Rejected", "Rejected"
        CANCELLED = "Cancelled", "Cancelled"

    class ClearanceCheckResult(models.TextChoices):
        NO_CHECK_NEEDED = "Active - No Check Needed", "Active - No Check Needed"
        CLEARED = "Cleared", "Cleared"
        NOT_CLEARED = "Not Cleared", "Not Cleared"

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
    # Legacy slot booking. PROTECT: a slot with requests against it can't be deleted from under them.
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
    # True for college alumni (undergraduate or graduate) who graduated before 2018, from the date they gave.
    requires_archive_retrieval = models.BooleanField(default=False)

    # Pages per copy, counted by the Registrar at approval for per-page documents; students can't know it. Null otherwise.
    page_count = models.PositiveIntegerField(null=True, blank=True)

    # Null until processing completes; 0 would falsely read as "done instantly".
    processing_time_hours = models.PositiveIntegerField(null=True, blank=True)
    is_rush = models.BooleanField(default=False)

    # Front Desk fields: read-only on every student-facing endpoint.
    clearance_check_result = models.CharField(
        max_length=30,
        choices=ClearanceCheckResult.choices,
        null=True,
        blank=True,
    )
    clearance_checked_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        related_name="clearance_checks",
        null=True,
        blank=True,
    )
    clearance_checked_at = models.DateTimeField(null=True, blank=True)

    # The locked price: stored only when the payment is logged, never from client input. Until then it stays null and
    # current_amount_due() works the price out from today's fee. or_number and payment_date are staff-entered.
    amount_due = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    or_number = models.CharField(max_length=50, null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)

    # Claim-stub and pickup fields.
    arrival_notice_sent_at = models.DateTimeField(null=True, blank=True)
    claim_stub_issued_at = models.DateTimeField(null=True, blank=True)
    digital_stub_active = models.BooleanField(default=False)

    # The approval the printed form attests to; updated_at can't stand in, since it moves on any later write.
    registrar_approved_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        related_name="registrar_approvals",
        null=True,
        blank=True,
    )
    registrar_approved_at = models.DateTimeField(null=True, blank=True)

    # Staff-facing fraud signal, never shown to the student.
    duplicate_flag = models.BooleanField(default=False)

    # Set when the student cancels, which they can do only before payment is logged (see CANCELLABLE_STATUSES).
    cancelled_at = models.DateTimeField(null=True, blank=True)
    # Set when the student adds or changes their proxy at Ready for Pickup, so Window 6 notices a late change.
    proxy_changed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.request_code} - {self.user.email}"

    def current_amount_due(self):
        """The amount every screen and printout shows: the locked amount once payment is logged, otherwise today's price.

        A Rejected or Cancelled request is never paid, so it has nothing to show.
        """
        if self.price_locked():
            return self.amount_due
        if self.request_status in (self.RequestStatus.REJECTED, self.RequestStatus.CANCELLED):
            return None
        return self.calculate_amount_due()

    def price_locked(self):
        """True once the Cashier payment is logged; from then on amount_due is the price, whatever the fee becomes."""
        return bool(self.or_number)

    def calculate_amount_due(self):
        """The price at today's fee (base x pages x copies, plus add-ons); None with no published fee, or a per-page document not yet counted.

        The one place the price is worked out. It reads the fee live, so it is only ever stored when the payment is logged.
        """
        fee = self.transaction_type.fee_amount
        if fee is None:
            return None

        form_data = self._submission_form_data()
        base = fee
        if self.transaction_type.pricing_unit == "per_page":
            if not self.page_count:
                return None
            base = fee * self.page_count

        try:
            copies = max(1, int(form_data.get("number_of_copies")))
        except (TypeError, ValueError):
            # Lives in free-form form_data, so it can be missing or a string.
            copies = 1
        return base * copies + self.fee_add_ons()

    def fee_add_ons(self):
        """The rush and Completion-of-INC fees this request carries on top of the document fee."""
        total = Decimal("0.00")
        if self.is_rush:
            total += RUSH_FEE
        if self._submission_form_data().get("purpose") == FormSubmission.Purpose.COMPLETION_OF_INC:
            total += COMPLETION_OF_INC_FEE
        return total

    def _submission_form_data(self):
        submission = getattr(self, "submission", None)
        return (submission.form_data if submission else None) or {}

    def scheduled_release(self):
        """(date, time_start) for the handover, or None: the schedule first, then a legacy slot."""
        schedule = getattr(self, "release_schedule", None)
        if schedule is not None and schedule.release_date:
            return schedule.release_date, schedule.release_time_start
        # Legacy fallback for requests booked before release slots were retired.
        if self.release_slot is not None:
            return self.release_slot.slot_date, self.release_slot.start_time
        return None

    def receipt_available(self):
        """True only at Approved - Ready to Print; the print-and-pay form stops once payment is logged."""
        return self.request_status == self.RequestStatus.APPROVED

    def can_cancel(self):
        """Only before payment is logged: after that, undoing it is a refund conversation with staff, not a button."""
        return self.request_status in CANCELLABLE_STATUSES

    def can_change_proxy(self):
        """Only once the document is ready: earlier is too soon to matter, and after release it has been collected."""
        return self.request_status == self.RequestStatus.READY

    def blocked_by_clearance(self):
        """True if a Not Cleared result must block any move to Processing or later."""
        return self.clearance_check_result == self.ClearanceCheckResult.NOT_CLEARED


CANCELLABLE_STATUSES = frozenset(
    {FormRequest.RequestStatus.SUBMITTED, FormRequest.RequestStatus.VERIFIED, FormRequest.RequestStatus.APPROVED}
)


class FormSubmission(models.Model):
    """The student's answers for one request; form_data is JSON because the questions vary by document and academic status."""

    class Purpose(models.TextChoices):
        """Part 3 of FM-USTP-RGTR-09, verbatim, because the PDF prints these strings back."""

        EVALUATION = "For Evaluation", "For Evaluation"
        EMPLOYMENT = "For Employment", "For Employment"
        SCHOLARSHIP = "For Scholarship", "For Scholarship"
        PERSONAL_FILE = "For Personal File", "For Personal File"
        PASSPORT = "For Passport", "For Passport"
        ADVANCED_STUDIES = "For Advanced Studies", "For Advanced Studies"
        BOARD_EXAM = "For Board Exam", "For Board Exam"
        RANKING = "For Ranking", "For Ranking"
        COMPLETION_OF_INC = "For Completion of INC", "For Completion of INC"
        OTHERS = "Others", "Others"

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="submission",
    )
    form_data = models.JSONField(default=dict, blank=True)
    # Required when the purpose is Board Exam (enforced in the serializer).
    board_exam_photo = models.FileField(upload_to="board_exam_photos/%Y/%m/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission for {self.form_request.request_code}"


class SubmissionAttachment(models.Model):
    """One student-uploaded file supporting a request; board_exam_photo stays its own column because validation keys off it."""

    form_submission = models.ForeignKey(
        FormSubmission,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    # Past 100 characters Django raises rather than truncating, and real filenames get that long.
    file = models.FileField(upload_to="submission_attachments/%Y/%m/", max_length=255)

    # The student's own filename, since storage rewrites the path.
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="Size in bytes.")

    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]

    def __str__(self):
        return f"{self.file_name} for {self.form_submission.form_request.request_code}"

    def save(self, *args, **kwargs):
        # Size and name come from the file itself, never from the request body.
        if self.file:
            if not self.file_name:
                self.file_name = self.file.name.rsplit("/", 1)[-1]
            if not self.file_size:
                try:
                    self.file_size = self.file.size
                except (OSError, ValueError):
                    self.file_size = 0
        super().save(*args, **kwargs)


class RequestProxy(models.Model):
    """The single person, if any, nominated to collect the documents for the student."""

    class Relationship(models.TextChoices):
        PARENT = "Parent", "Parent"
        SIBLING = "Sibling", "Sibling"
        SPOUSE = "Spouse", "Spouse"
        FRIEND = "Friend", "Friend"
        OTHER = "Other", "Other"

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="proxy",
    )
    proxy_full_name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    contact_number = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.proxy_full_name} ({self.relationship}) for {self.form_request.request_code}"


class ReleaseSchedule(models.Model):
    """The claim record for one request's release: who collected it, when, and how they signed."""

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="release_schedule",
    )
    # Where this claim record stands; request_status "Released" is the lifecycle-level counterpart.
    release_status = models.CharField(
        max_length=20,
        choices=[
            ("Scheduled", "Scheduled"),
            ("Claimed", "Claimed"),
        ],
        default="Scheduled",
    )
    # When the handover is booked for, as written by Mark Ready to Release.
    release_date = models.DateField(null=True, blank=True)
    release_time_start = models.TimeField(null=True, blank=True)

    # Legacy link to the slot a booking came from. SET_NULL: deleting a slot keeps the booking.
    release_slot = models.ForeignKey(
        ReleaseSlot,
        on_delete=models.SET_NULL,
        related_name="release_schedules",
        null=True,
        blank=True,
    )

    claimed_at = models.DateTimeField(null=True, blank=True)
    claimant_name = models.CharField(max_length=150, null=True, blank=True)
    # A real uploaded signature image, same pattern as board_exam_photo.
    claimant_signature = models.FileField(upload_to="claim_signatures/%Y/%m/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Release record for {self.form_request.request_code}"


class FaqEntry(models.Model):
    """The chatbot's knowledge base for general questions; document-specific answers come from TransactionType."""

    class Category(models.TextChoices):
        STATUS_TRACKING = "Status & Tracking", "Status & Tracking"
        REQUIREMENTS_PROCESS = "Requirements & Process", "Requirements & Process"
        CLAIM_STUB_PICKUP = "Claim Stub & Pickup", "Claim Stub & Pickup"
        ACCOUNT_TECHNICAL = "Account/Technical", "Account/Technical"
        GENERAL_INFO = "General Info", "General Info"

    category = models.CharField(max_length=50, choices=Category.choices)
    question = models.TextField()
    answer = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "FAQ entry"
        verbose_name_plural = "FAQ entries"

    def __str__(self):
        return self.question[:80]


class RequirementVerification(models.Model):
    """One verify/reject decision; a request can have several, and the latest is the current one."""

    class VerificationStatus(models.TextChoices):
        VERIFIED = "Verified", "Verified"
        REJECTED = "Rejected", "Rejected"

    form_request = models.ForeignKey(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="verifications",
    )
    verification_status = models.CharField(max_length=20, choices=VerificationStatus.choices)
    verified_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        related_name="verifications_made",
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(default=timezone.now)
    remarks = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-verified_at"]

    def __str__(self):
        return f"{self.verification_status} - {self.form_request.request_code}"


class Notification(models.Model):
    """A message to a student about one of their requests; stored in-app only, as there is no push transport."""

    class NotificationType(models.TextChoices):
        APPROVED = "Approved", "Approved - Ready to Print"
        PROCESSING = "Processing", "Processing"
        READY = "Ready", "Ready for Pickup"
        RELEASED = "Released", "Released"
        REJECTED = "Rejected", "Rejected"
        CANCELLED = "Cancelled", "Cancelled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    form_request = models.ForeignKey(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=150)
    message = models.TextField()

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notification_type} -> {self.user.email}"
