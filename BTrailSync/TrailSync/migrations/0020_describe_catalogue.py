from django.db import migrations

# Plain-language descriptions for the documents on FM-USTP-RGTR-09. These are
# what a first-time requester reads on the Request Form's cards and in the
# Credential Guide, where seven of the ten types previously showed only a
# generic "Registrar document request." - no help at all when deciding which
# document you need.
#
# Written conservatively: each says what the document IS, not what it's
# needed for in any particular case, since a wrong claim here could send
# someone to request and pay for the wrong thing. Evaluation and Permit to
# Study use their usual Philippine registrar meanings and should be checked
# against how USTP uses them (see the chat note).
DESCRIPTIONS = {
    "Authentication": (
        "The Registrar certifies that photocopies of your school documents are "
        "true copies of the originals. Charged per page."
    ),
    "CAV Certification": (
        "Certification, Authentication and Verification of your school records "
        "for a government agency — often needed to work or study abroad."
    ),
    "Certification": (
        "An official letter from the Registrar confirming something about your "
        "records — for example that you're enrolled, have graduated, or your "
        "GPA. You'll choose what it should say."
    ),
    "Correction of Name": "Corrects a misspelled or wrong name on your school records.",
    "Evaluation": (
        "A review of the subjects you've completed — for example, to see "
        "what you still need to graduate."
    ),
    "Form 137": "Your permanent school record, usually asked for when you transfer to another school.",
    "Honorable Dismissal": (
        "Issued when you transfer out, confirming you are leaving the "
        "university in good standing."
    ),
    "Permit to Study": "Permission from USTP to take subjects at another school.",
}

# Certification inherited this when "Certificate of Enrollment" was folded
# into it, but Certification now covers fourteen kinds of statement, so the
# old text is wrong. Replaced only if it's still exactly this - an admin's own
# edit is never overwritten.
STALE_CERTIFICATION = "Confirms current enrollment status for the active term."


def describe(apps, schema_editor):
    TransactionType = apps.get_model("TrailSync", "TransactionType")
    filled = 0
    for name, text in DESCRIPTIONS.items():
        row = TransactionType.objects.filter(name=name).first()
        if row is None:
            continue
        current = (row.description or "").strip()
        if not current or (name == "Certification" and current == STALE_CERTIFICATION):
            row.description = text
            row.save(update_fields=["description"])
            filled += 1
    print(f"    described {filled} document type(s)")


class Migration(migrations.Migration):

    dependencies = [
        ("TrailSync", "0019_userprofile_tour_completed_at"),
    ]

    # No reverse: blanking descriptions back out would only make the
    # catalogue less useful, and admin edits made since can't be told apart.
    operations = [migrations.RunPython(describe, migrations.RunPython.noop)]
