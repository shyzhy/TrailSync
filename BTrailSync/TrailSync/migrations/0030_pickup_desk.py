from django.db import migrations, models


def clear_stale_arrivals(apps, schema_editor):
    """arrival_notice_sent_at now means "the student is at Window 6", not "we told them it's ready".

    Mark Ready used to stamp it, so every request it had ever readied carries a time that means the other thing. Left
    alone, the Waiting for Pickup list would open with a queue of people who aren't there. The fact it used to record
    is kept anyway, in the "Ready for pickup" notification each of those requests already has.
    """
    FormRequest = apps.get_model("TrailSync", "FormRequest")
    FormRequest.objects.exclude(arrival_notice_sent_at=None).update(arrival_notice_sent_at=None)


class Migration(migrations.Migration):
    dependencies = [
        ("TrailSync", "0029_payment_proofs"),
    ]

    operations = [
        migrations.AddField(
            model_name="releaseschedule",
            name="missed_pickup_notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="releaseschedule",
            name="requested_reschedule_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="releaseschedule",
            name="reschedule_status",
            field=models.CharField(
                blank=True,
                choices=[("Pending", "Waiting for the Registrar"), ("Approved", "Approved"), ("Rejected", "Rejected")],
                max_length=20,
                null=True,
            ),
        ),
        # Not reversed: the cleared times meant something this column no longer records.
        migrations.RunPython(clear_stale_arrivals, migrations.RunPython.noop),
    ]
