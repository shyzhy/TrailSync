from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils import timezone

from TrailSync.models import (
    FaqEntry,
    FormRequest,
    FormSubmission,
    Notification,
    ReleaseSchedule,
    ReleaseSlot,
    RequestProxy,
    RequirementVerification,
    Role,
    StaffProfile,
    SubmissionAttachment,
    TransactionType,
    User,
    UserProfile,
)


# Django's forms for a custom user model, so passwords typed into /admin/ are hashed rather than saved in plain text.
class TrailSyncUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email",)


class TrailSyncUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = TrailSyncUserCreationForm
    form = TrailSyncUserChangeForm
    model = User
    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "role", "status", "is_staff"]
    list_filter = ["role", "status", "is_staff", "is_superuser"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "contact_number")}),
        ("Role & status", {"fields": ("role", "status")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
    )


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    """Pending staff accounts are approved with a dropdown directly in the list view."""

    list_display = [
        "employee_id",
        "user",
        "assigned_window",
        "approval_status",
        "availability_status",
        "approved_by",
        "approved_at",
    ]
    list_display_links = ["employee_id", "user"]
    list_editable = ["approval_status"]
    list_filter = ["approval_status", "assigned_window", "availability_status"]
    search_fields = ["employee_id", "user__email", "user__first_name", "user__last_name"]

    def save_model(self, request, obj, form, change):
        # Approving in the list also records who approved and when.
        if (
            change
            and "approval_status" in form.changed_data
            and obj.approval_status == StaffProfile.ApprovalStatus.APPROVED
        ):
            if not obj.approved_at:
                obj.approved_at = timezone.now()
            if not obj.approved_by_id:
                obj.approved_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["role_name", "description"]


admin.site.register(UserProfile)
admin.site.register(TransactionType)
admin.site.register(FormRequest)
admin.site.register(FormSubmission)
admin.site.register(ReleaseSlot)
admin.site.register(RequestProxy)
admin.site.register(ReleaseSchedule)
admin.site.register(FaqEntry)
admin.site.register(RequirementVerification)
admin.site.register(Notification)
admin.site.register(SubmissionAttachment)
