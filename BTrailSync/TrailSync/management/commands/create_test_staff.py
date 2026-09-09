"""One-off bootstrap for a working Registrar Staff test account.

There is no admin-approval UI built yet, and staff accounts cannot log in
until StaffProfile.approval_status = "Approved" (enforced in LoginView) — so
without this command, the only way to get a testable staff login would be to
hand-edit the database. This creates one account already fully approved.
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from TrailSync.models import Role, StaffProfile, User


class Command(BaseCommand):
    help = "Creates one pre-approved Registrar Staff account for local testing."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", required=True)
        parser.add_argument("--first-name", required=True, dest="first_name")
        parser.add_argument("--last-name", required=True, dest="last_name")
        parser.add_argument("--employee-id", required=True, dest="employee_id")
        parser.add_argument(
            "--window",
            default="6",
            help="StaffProfile.assigned_window value (default: 6, matching the rest of the app).",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        employee_id = options["employee_id"].strip()

        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"A user with email {email} already exists.")
        if StaffProfile.objects.filter(employee_id=employee_id).exists():
            raise CommandError(f"Employee ID {employee_id} is already in use.")

        try:
            role = Role.objects.get(role_name=Role.RoleName.REGISTRAR)
        except Role.DoesNotExist:
            raise CommandError(
                "The 'Registrar Staff' role isn't seeded in ROLES yet — nothing to assign this account to."
            )

        # create_user() hashes the password via set_password() — same path
        # RegisterSerializer uses for students, so this account authenticates
        # exactly like a real one, not a shortcut that happens to "look" right.
        user = User.objects.create_user(
            email=email,
            password=options["password"],
            first_name=options["first_name"].strip(),
            last_name=options["last_name"].strip(),
            role=role,
            status="Active",
        )

        staff_profile = StaffProfile.objects.create(
            user=user,
            employee_id=employee_id,
            assigned_window=options["window"],
            availability_status="Available",
            approval_status=StaffProfile.ApprovalStatus.APPROVED,
            approved_at=timezone.now(),
            # Left null rather than self-referencing the new account: no
            # admin exists yet to actually attribute this approval to, and a
            # staff member "approving themselves" would be a confusing thing
            # to find in an audit trail later. null here honestly means
            # "bootstrap-created, already approved" rather than claiming a
            # real approval happened.
            approved_by=None,
        )

        self.stdout.write(self.style.SUCCESS("Test staff account created:"))
        self.stdout.write(f"  Email:        {email}")
        self.stdout.write(f"  Password:     {options['password']}")
        self.stdout.write(f"  Name:         {user.first_name} {user.last_name}")
        self.stdout.write(f"  Employee ID:  {staff_profile.employee_id}")
        self.stdout.write(f"  Window:       {staff_profile.assigned_window}")
        self.stdout.write("  Approval:     Approved (approved_by left null - see source comment)")
