from django.contrib import admin
from TrailSync.models import Role, User, UserProfile, StaffProfile

# Register your models here.

admin.site.register(Role)
admin.site.register(User)
admin.site.register(UserProfile)
admin.site.register(StaffProfile)


