from django.contrib import admin
from TrailSync.models import (
    FaqEntry,
    FormRequest,
    FormSubmission,
    ReleaseSchedule,
    ReleaseSlot,
    RequestProxy,
    Role,
    StaffProfile,
    TransactionType,
    User,
    UserProfile,
)

# Register your models here.

admin.site.register(Role)
admin.site.register(User)
admin.site.register(UserProfile)
admin.site.register(StaffProfile)
admin.site.register(TransactionType)
admin.site.register(FormRequest)
admin.site.register(FormSubmission)
admin.site.register(ReleaseSlot)
admin.site.register(RequestProxy)
admin.site.register(ReleaseSchedule)
admin.site.register(FaqEntry)


