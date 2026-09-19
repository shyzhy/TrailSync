from django.db import migrations, models

# The documents FM-USTP-RGTR-09 lists in Part 2, by the name each has had since the catalogue was seeded.
CODES = {
    "Authentication": "authentication",
    "CAV Certification": "cav_certification",
    "Certification": "certification",
    "Correction of Name": "correction_of_name",
    "Diploma Replacement": "diploma_replacement",
    "Evaluation": "evaluation",
    "Form 137": "form_137",
    "Honorable Dismissal": "honorable_dismissal",
    "Permit to Study": "permit_to_study",
    "Transcript of Records": "transcript_of_records",
}


def set_codes(apps, schema_editor):
    TransactionType = apps.get_model("TrailSync", "TransactionType")
    for name, code in CODES.items():
        TransactionType.objects.filter(name=name).update(code=code)


def clear_codes(apps, schema_editor):
    apps.get_model("TrailSync", "TransactionType").objects.update(code=None)


class Migration(migrations.Migration):
    dependencies = [
        ("TrailSync", "0027_official_form_archive"),
    ]

    operations = [
        migrations.AddField(
            model_name="transactiontype",
            name="code",
            field=models.SlugField(blank=True, editable=False, max_length=50, null=True, unique=True),
        ),
        migrations.RunPython(set_codes, clear_codes),
    ]
