from django.db import migrations


def activate_stub_for_paid_requests(apps, schema_editor):
    """Switch on the claim stub for requests that were already paid.

    Approve & Log only began setting digital_stub_active as part of the
    lifecycle amendment. Anything that passed through that step earlier sits
    at Processing or beyond with the flag still False, so the student cannot
    download a stub for a document they have already paid for and are waiting
    to collect - the exact window the stub exists to serve.

    claim_stub_issued_at is recovered from the "Payment received" notification
    where one exists, since that row was written in the same transaction as
    the payment and is therefore the real moment of issue. Otherwise it falls
    back to updated_at, which is the closest thing left on the row.
    """
    FormRequest = apps.get_model("TrailSync", "FormRequest")
    Notification = apps.get_model("TrailSync", "Notification")

    activated = 0
    for req in FormRequest.objects.filter(
        request_status__in=("Processing", "Ready", "Released"),
        digital_stub_active=False,
    ):
        paid_note = (
            Notification.objects.filter(form_request=req, notification_type="Processing")
            .order_by("created_at")
            .first()
        )
        req.digital_stub_active = True
        req.claim_stub_issued_at = paid_note.created_at if paid_note else req.updated_at
        req.save(update_fields=["digital_stub_active", "claim_stub_issued_at"])
        activated += 1
    print(f"    activated the claim stub on {activated} already-paid request(s)")


def deactivate(apps, schema_editor):
    """Reverse: only unset what this migration could have set."""
    FormRequest = apps.get_model("TrailSync", "FormRequest")
    FormRequest.objects.filter(
        request_status__in=("Processing", "Ready", "Released"), digital_stub_active=True
    ).update(digital_stub_active=False, claim_stub_issued_at=None)


class Migration(migrations.Migration):

    dependencies = [
        ("TrailSync", "0014_releaseschedule_release_date_and_more"),
    ]

    operations = [
        migrations.RunPython(activate_stub_for_paid_requests, deactivate),
    ]
