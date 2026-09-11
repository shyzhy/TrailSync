from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models
from django.utils import timezone

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
    """A requestable document, e.g. Transcript of Records, Certificate of Enrollment.

    This is the ONE admin-editable source for a document's requirements/fee/
    processing time — the Request Form's Step 1, the Credential Guide catalog,
    and (eventually) the AI chatbot's answers all read the same rows here
    rather than each keeping their own copy.
    """

    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)

    # Shown on the Request a Form page as "You'll need: ..." once a document
    # type is picked, so students know what to prepare before they submit.
    # Free text, comma/semicolon/newline-separated — surfaces split it into a
    # list for display rather than requiring a separate structured field.
    required_documents = models.TextField(blank=True, null=True)
    # Both optional/informational — left blank where a document type has no
    # fixed fee or published turnaround.
    processing_time = models.CharField(max_length=100, blank=True, null=True)
    fee_amount = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    # Which of FormSubmission.Purpose this document is commonly requested
    # for — powers the Credential Guide's purpose filter chips. A list
    # (JSONField) rather than a single choice since a document can serve
    # more than one purpose (e.g. Transcript of Records for both further
    # studies and employment).
    common_purposes = models.JSONField(default=list, blank=True)
    # Conditional/exceptional info worth flagging distinctly, e.g. "Board
    # Exam purpose requires an additional 2x2 photo upload." Optional —
    # most document types won't need one.
    special_notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ReleaseSlot(models.Model):
    """A bookable release-day window at Window 6.

    available_slots was originally meant as a live "remaining" counter,
    decremented as students booked a slot at submission time. The Request
    Form wizard no longer offers slot selection at submission (dropped when
    it was rebuilt into its current 4 steps), so nothing decrements this
    field anymore — it would silently go stale as a remaining-capacity
    counter. It's now treated as TOTAL CAPACITY instead: "assigned" and
    "remaining" are computed live from FormRequest.release_slot wherever
    they're needed (see ReleaseSlotDetailSerializer), rather than trusted
    from this column.
    """

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


class FormRequest(models.Model):
    """A student/alumni's request for one document, tracked through to release."""

    class RequestStatus(models.TextChoices):
        """The request lifecycle, in order.

        Stored values are kept short and URL-safe (they travel through query
        strings on the Processing Queue filter) while the human labels carry
        the wording the feature docs use - the same split that "Ready" ->
        "Ready for Pickup" already used before this change.

        APPROVED replaced an earlier "Verified" value when the lifecycle was
        filled in, and a data migration rewrote existing rows. The name
        changed because the step means more than "the requirements check
        out": it is where the Registrar signs off, the fee is assessed, and
        the student can print the Cashier form. Verification as an EVENT is
        still recorded separately in RequirementVerification.

        PROCESSING is entered only once staff has logged a real Cashier
        payment (or_number + payment_date). That payment happens in person
        and cannot be captured digitally at the moment it occurs, so this
        transition is a staff attestation rather than a system observation.

        There is deliberately no "Blocked" member. A blocked request is one
        whose clearance_check_result is "Not Cleared" (see
        blocked_by_clearance) - a separate axis from lifecycle position, and
        folding it in here would lose the stage the request was blocked at.
        """

        SUBMITTED = "Submitted", "Pending Verification"
        APPROVED = "Approved", "Approved - Ready to Print"
        PROCESSING = "Processing", "Processing"
        READY = "Ready", "Ready for Pickup"
        RELEASED = "Released", "Released"
        REJECTED = "Rejected", "Rejected"

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
    # Derived server-side from the alumni-only Graduation Date question in
    # Step 2 (True when that date is before 2018) rather than asked directly
    # — current students never see the question and this stays False for them.
    requires_archive_retrieval = models.BooleanField(default=False)

    # --- Added to match the current ERD/feature docs (see chat) ---

    # Filled once processing completes, not at submission — stays blank
    # until then, hence PositiveIntegerField(null=True) rather than a
    # default of 0 (0 would falsely read as "done instantly").
    processing_time_hours = models.PositiveIntegerField(null=True, blank=True)
    is_rush = models.BooleanField(default=False)

    # Front Desk staff-logged fields. Student-facing endpoints must treat
    # these as read-only — see the serializer note below.
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

    # Cashier/payment fields. amount_due is set server-side when Registrar
    # approves (pulled from TransactionType.fee_amount) — never accepted as
    # client input; or_number/payment_date are staff-entered after payment.
    amount_due = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    or_number = models.CharField(max_length=50, null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)

    # Claim-stub / pickup fields.
    arrival_notice_sent_at = models.DateTimeField(null=True, blank=True)
    claim_stub_issued_at = models.DateTimeField(null=True, blank=True)
    digital_stub_active = models.BooleanField(default=False)

    # Registrar approval attribution, for the printable Cashier form's
    # signature block. RequirementVerification already records who verified
    # a request and when, but that's a log of verification EVENTS (a request
    # can be rejected, revised, and re-verified); these two columns are the
    # single authoritative "this is the approval the printed form is
    # attesting to". updated_at can't stand in for the timestamp — it moves
    # on any later write to the row, so a form reprinted next week would
    # show a different "date approved" than the one the student first took
    # to the Cashier.
    #
    # Named registrar_approved_by (column: registrar_approved_by_id) rather
    # than the ERD's registrar_approved_by_staff_profile_id, matching how
    # clearance_checked_by is already done a few fields up — the whole file
    # uses the short form for StaffProfile FKs.
    registrar_approved_by = models.ForeignKey(
        StaffProfile,
        on_delete=models.SET_NULL,
        related_name="registrar_approvals",
        null=True,
        blank=True,
    )
    registrar_approved_at = models.DateTimeField(null=True, blank=True)

    # Staff-facing fraud signal only — never surfaced to the student.
    duplicate_flag = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.request_code} - {self.user.email}"

    def compute_amount_due(self):
        """What this request costs at the Cashier: the document's fee times
        the number of copies asked for.

        Called when Registrar approves, not at submission — the fee is
        whatever TransactionType charges at approval time, and stamping it
        onto the row means a later admin edit to the fee can't retroactively
        change what an already-printed form said the student owed.

        Returns None when the document type has no published fee, which is a
        real case (fee_amount is nullable): the form then prints a blank
        line to be written in by hand rather than a misleading 0.00.
        """
        fee = self.transaction_type.fee_amount
        if fee is None:
            return None

        submission = getattr(self, "submission", None)
        raw_copies = ((submission.form_data if submission else None) or {}).get("number_of_copies")
        try:
            copies = int(raw_copies)
        except (TypeError, ValueError):
            # number_of_copies lives in the free-form form_data JSON, so it
            # can be missing or a string; one copy is the safe reading.
            copies = 1
        return fee * max(1, copies)

    def scheduled_release(self):
        """(date, time_start) for this request's handover, or None.

        Reads ReleaseSchedule first, since that is what Mark Ready to Release
        writes and what staff may have adjusted by hand. Falls back to the
        booked ReleaseSlot for requests assigned a slot on the Release Slots
        page but not yet marked ready, so the student can see a window before
        staff has confirmed it.

        One accessor because four places need this - the claim stub PDF, the
        notification text, the review page and the student's ticket - and
        each working out its own precedence is how they drift apart.
        """
        schedule = getattr(self, "release_schedule", None)
        if schedule is not None and schedule.release_date:
            return schedule.release_date, schedule.release_time_start
        if self.release_slot is not None:
            return self.release_slot.slot_date, self.release_slot.start_time
        return None

    def receipt_available(self):
        """True only while the request sits at Approved - Ready to Print.

        Deliberately a single stage rather than "approved or later". The
        document is a print-and-pay form carrying a blank Cashier section;
        once staff has logged the payment the request moves to Processing and
        that form has nothing left to do, so it stops being generated instead
        of lingering as a stale artefact someone could carry back to a window.

        Consequence worth knowing: the tear-off claim stub lives on that same
        PDF, so it stops being re-downloadable after payment is logged. A
        student who loses the paper between the Cashier and Window 6 has to
        be looked up by request_code at the window instead.

        The API and the UI both gate on this one method rather than each
        keeping a copy of the status list that could drift.
        """
        return self.request_status == self.RequestStatus.APPROVED

    def blocked_by_clearance(self):
        """True if this request's clearance result should hard-block any
        transition to Processing or later.

        No staff-facing status-update endpoint exists yet anywhere in this
        codebase (everything built so far is student-facing) — this method
        is where that endpoint should call in once it exists, rather than
        the check being reimplemented ad hoc at each call site.
        """
        return self.clearance_check_result == self.ClearanceCheckResult.NOT_CLEARED


class FormSubmission(models.Model):
    """The student-supplied details for one FormRequest.

    One-to-one because this is the *content* of a single request, not a
    repeatable line item — a student wanting two different purposes files
    two separate FormRequests.

    form_data holds every Step 2 wizard answer (purpose, purpose_other,
    number_of_copies, semester, additional_notes, graduation_date for
    alumni) as JSON rather than one column per field — the wizard's fields
    already vary by transaction type and user category, and a fixed column
    set can't keep up with that without a migration every time a new
    document type needs a new question. Structured fields the rest of the
    backend actually queries against (board_exam_photo) stay as real columns.
    """

    class Purpose(models.TextChoices):
        EMPLOYMENT = "Employment", "Employment"
        FURTHER_STUDIES = "Further studies", "Further studies"
        SCHOLARSHIP = "Scholarship", "Scholarship"
        BOARD_EXAM = "Board Exam", "Board Exam"
        OTHER = "Other", "Other"

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="submission",
    )
    form_data = models.JSONField(default=dict, blank=True)
    # A real uploaded file, not just a filename in form_data — required when
    # form_data["purpose"] == "Board Exam" (enforced in the serializer).
    board_exam_photo = models.FileField(upload_to="board_exam_photos/%Y/%m/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission for {self.form_request.request_code}"


class RequestProxy(models.Model):
    """An authorized claimant nominated to pick up documents on the
    student's behalf. One-to-one: a request either has a single nominated
    proxy or none — Step 3 of the wizard is a straight on/off toggle, not a
    list.
    """

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
    """The actual claim record for one FormRequest's release — who picked it
    up, when, and how they signed for it.

    This is a NEW table: it didn't exist anywhere in models.py before this
    change, despite being referenced (e.g. Track Requests' serializer
    already has a `release_schedule` field that was, until now, only ever
    populated from ReleaseSlot as a stand-in). ReleaseSlot is the bookable
    CAPACITY WINDOW a request is scheduled against; this is the record of
    what happened when the document was actually claimed at that window —
    a different concept, so it gets its own one-to-one table rather than
    more columns bolted onto ReleaseSlot or FormRequest.
    """

    form_request = models.OneToOneField(
        FormRequest,
        on_delete=models.CASCADE,
        related_name="release_schedule",
    )
    # Where this claim record sits. Until now "Claimed vs Scheduled" was
    # derived from whether claimed_at was set, which reads the same but
    # cannot distinguish "not claimed yet" from "claim recorded without a
    # timestamp". Named release_status per the ERD; the request row's own
    # request_status = "Released" is the lifecycle-level counterpart.
    release_status = models.CharField(
        max_length=20,
        choices=[
            ("Scheduled", "Scheduled"),
            ("Claimed", "Claimed"),
        ],
        default="Scheduled",
    )
    # When the handover is booked for. Always populated by Mark Ready to
    # Release, whether staff picked an existing slot or typed a freeform
    # time, so every consumer - the claim stub PDF, the notification text,
    # the student's tracking view - reads these same two fields and never
    # has to know which path was taken.
    release_date = models.DateField(null=True, blank=True)
    release_time_start = models.TimeField(null=True, blank=True)

    # The slot those values were taken from, when one was chosen. NULL means
    # a freeform time that deliberately does not consume slot capacity -
    # Window 6 can tell someone to come by outside the published windows
    # without that eating a bookable place.
    #
    # SET_NULL rather than PROTECT (which FormRequest.release_slot uses):
    # release_date and release_time_start are stored directly, so deleting a
    # slot should drop the linkage while leaving the booking itself intact,
    # not block the delete.
    release_slot = models.ForeignKey(
        ReleaseSlot,
        on_delete=models.SET_NULL,
        related_name="release_schedules",
        null=True,
        blank=True,
    )

    claimed_at = models.DateTimeField(null=True, blank=True)
    claimant_name = models.CharField(max_length=150, null=True, blank=True)
    # A real uploaded signature image rather than a manually-managed path
    # string — same pattern as FormSubmission.board_exam_photo. Named
    # without the "_path" suffix since FileField already manages that
    # internally; storage still resolves to a path on disk either way.
    claimant_signature = models.FileField(upload_to="claim_signatures/%Y/%m/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Release record for {self.form_request.request_code}"


class FaqEntry(models.Model):
    """The chatbot's knowledge base for general questions not tied to a
    specific document type — document-specific questions pull from
    TransactionType instead, per the same shared-content-source design the
    Credential Guide already uses.

    Uses Django's default auto `id` PK rather than a literal `faq_id`
    column, matching every other model in this file (none of them have a
    literal `_id`-suffixed PK field despite the ERD naming convention).
    category is constrained to TextChoices rather than free text, matching
    how Role/RequestStatus/etc. are already done elsewhere in this codebase
    — still a plain CharField underneath, just with fixed valid values.
    """

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
    """One staff verify/reject decision on a FormRequest's submitted
    requirements. Did not exist before this table — the Processing Queue
    explicitly needs verified_by/verified_at/remarks and nothing earlier
    captured this.

    A ForeignKey (not OneToOne) to FormRequest on purpose: a request can be
    rejected, revised by the student, and re-verified later, so this is a
    history of verification EVENTS, not a single current record. "The"
    current verification is whichever row is most recent (default ordering
    below), which is how TrackedFormRequestSerializer's verification_remarks
    reads it.
    """

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
    """A message to a student about one of their requests.

    THIS TABLE DID NOT EXIST before the lifecycle work. The brief referred to
    "NOTIFICATIONS rows" as if they were already in the schema alongside
    or_number and claimed_at, but nothing here or in any migration defined
    one - so it is created here rather than the lifecycle transitions
    silently skipping the notify step.

    Kept to in-app records on purpose. The brief also mentions these
    "trigger push via DEVICE_TOKENS"; there is no DEVICE_TOKENS table and no
    push infrastructure in this project, and inventing a delivery guarantee
    the system cannot honour would be worse than storing the message and
    letting a real transport read from here later. Every row written at a
    lifecycle transition is exactly the payload such a transport would send.

    form_request is nullable so account-level messages (an approved staff
    registration, say) can live in the same inbox later without a second
    table; every row this codebase writes today does reference a request.
    """

    class NotificationType(models.TextChoices):
        APPROVED = "Approved", "Approved - Ready to Print"
        PROCESSING = "Processing", "Processing"
        READY = "Ready", "Ready for Pickup"
        RELEASED = "Released", "Released"
        REJECTED = "Rejected", "Rejected"

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
