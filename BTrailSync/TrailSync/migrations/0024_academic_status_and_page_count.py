"""Academic status replaces user_category/academic_level/year_level; the Registrar now records a request's page count.

Existing data is carried over rather than dropped:
- user_category + academic_level become the matching academic_status option.
- last_semester_attended is taken from the student's latest request, whose "latest semester" answer is the same fact.
- A per-page request that was already assessed keeps the page count it was priced with, now in page_count.
"""
import re

from django.db import migrations, models

STATUS_FOR = {
    ("Student", "Undergraduate"): "Undergraduate Student",
    ("Student", "Graduate"): "Graduate/Masteral Student",
    ("Alumni", "High School"): "Alumnus — High School",
    ("Alumni", "Undergraduate"): "Alumnus — Undergraduate",
    ("Alumni", "Graduate"): "Alumnus — Graduate/Masteral",
}
LEGACY_FOR = {status: legacy for legacy, status in STATUS_FOR.items()}
# The request form only ever offered values in this exact spelling.
SEMESTER_RE = re.compile(r"^(1st Semester|2nd Semester|Summer), SY \d{4}-\d{4}$")


def _form_data(form_request):
    submission = getattr(form_request, "submission", None)
    return (submission.form_data if submission else None) or {}


def forwards(apps, schema_editor):
    UserProfile = apps.get_model("TrailSync", "UserProfile")
    FormRequest = apps.get_model("TrailSync", "FormRequest")

    for profile in UserProfile.objects.all():
        status = STATUS_FOR.get((profile.user_category, profile.academic_level))
        # A profile missing either half is left empty, so onboarding asks rather than the migration guessing.
        profile.academic_status = [status] if status else []
        latest = FormRequest.objects.filter(user_id=profile.user_id).order_by("-created_at").first()
        semester = _form_data(latest).get("semester") if latest else None
        if isinstance(semester, str) and SEMESTER_RE.match(semester):
            profile.last_semester_attended = semester
        profile.save(update_fields=["academic_status", "last_semester_attended"])

    assessed = FormRequest.objects.filter(transaction_type__pricing_unit="per_page", amount_due__isnull=False)
    for form_request in assessed:
        try:
            pages = int(_form_data(form_request).get("number_of_pages"))
        except (TypeError, ValueError):
            continue
        if pages > 0:
            form_request.page_count = pages
            form_request.save(update_fields=["page_count"])


def backwards(apps, schema_editor):
    UserProfile = apps.get_model("TrailSync", "UserProfile")
    for profile in UserProfile.objects.all():
        # The old model held one choice: a current-student option wins, as it decided the role.
        legacy = next((LEGACY_FOR[s] for s in (profile.academic_status or []) if s in LEGACY_FOR and "Student" in s), None)
        legacy = legacy or next((LEGACY_FOR[s] for s in (profile.academic_status or []) if s in LEGACY_FOR), (None, None))
        profile.user_category, profile.academic_level = legacy
        profile.save(update_fields=["user_category", "academic_level"])


class Migration(migrations.Migration):
    dependencies = [
        ("TrailSync", "0023_staff_profile_middle_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="academic_status",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="last_semester_attended",
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.AddField(
            model_name="formrequest",
            name="page_count",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(model_name="userprofile", name="academic_level"),
        migrations.RemoveField(model_name="userprofile", name="user_category"),
        migrations.RemoveField(model_name="userprofile", name="year_level"),
    ]
