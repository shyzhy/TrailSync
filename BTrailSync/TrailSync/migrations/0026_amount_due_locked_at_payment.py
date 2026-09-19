from django.db import migrations


def clear_unpaid_snapshots(apps, schema_editor):
    """amount_due now means the price locked at payment; before that it is worked out from the current fee.

    Snapshots stored at approval under the old rule would otherwise sit in the table looking locked, so unpaid requests
    drop theirs. Paid requests keep the amount they were charged.
    """
    FormRequest = apps.get_model("TrailSync", "FormRequest")
    FormRequest.objects.filter(or_number__isnull=True).exclude(amount_due=None).update(amount_due=None)
    FormRequest.objects.filter(or_number="").exclude(amount_due=None).update(amount_due=None)


class Migration(migrations.Migration):
    dependencies = [
        ("TrailSync", "0025_cancellation_and_late_proxy"),
    ]

    # Reversing doesn't bring the dropped snapshots back: they are the stale amounts this migration exists to remove.
    operations = [
        migrations.RunPython(clear_unpaid_snapshots, migrations.RunPython.noop),
    ]
