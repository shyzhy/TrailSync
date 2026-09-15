"""Root URL configuration for the BTrailSync project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from TrailSync.views import (
    RegistrarFlaggedRequestsView,
    RegistrarClearFlagView,
    NotificationUnreadCountView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationListView,
    MeTourView,
    MeOnboardingView,
    ChangeEmailConfirmView,
    ChangeEmailRequestView,
    ChangePasswordView,
    DashboardSummaryView,
    FormRequestListCreateView,
    FormRequestClaimStubView,
    FormRequestReceiptView,
    MeAvatarView,
    MeView,
    RecentFormRequestsView,
    RegistrarApproveLogView,
    RegistrarQueueApproveView,
    RegistrarDashboardSummaryView,
    RegistrarMarkReadyView,
    RegistrarQueueDetailView,
    RegistrarQueueListView,
    RegistrarQueueRejectView,
    RegistrarQueueVerifyView,
    RegistrarRecentSubmissionsView,
    RegistrarReleasedExportView,
    RegistrarReleasedListView,
    RegistrarReleaseView,
    RegistrarTodaysPickupsView,
    RegistrarReleaseCalendarDayView,
    RegistrarReleaseCalendarView,
    TransactionTypeListView,
    UpcomingReleaseDatesView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('TrailSync.urls')),
    path('api/me/', MeView.as_view(), name='me'),
    path('api/me/avatar/', MeAvatarView.as_view(), name='me-avatar'),
    path('api/me/tour/', MeTourView.as_view(), name='me-tour'),
    path('api/me/onboarding/', MeOnboardingView.as_view(), name='me-onboarding'),
    # Literal notification paths are registered before <int:pk>/ so they are never read as an id.
    path('api/notifications/', NotificationListView.as_view(), name='notifications'),
    path('api/notifications/unread-count/', NotificationUnreadCountView.as_view(), name='notifications-unread-count'),
    path('api/notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notifications-mark-all-read'),
    path('api/notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),
    path('api/me/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/me/change-email/request/', ChangeEmailRequestView.as_view(), name='change-email-request'),
    path('api/me/change-email/confirm/', ChangeEmailConfirmView.as_view(), name='change-email-confirm'),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/dashboard/recent-requests/', RecentFormRequestsView.as_view(), name='dashboard-recent-requests'),
    path('api/dashboard/upcoming-release-dates/', UpcomingReleaseDatesView.as_view(), name='dashboard-upcoming-release-dates'),
    path('api/transaction-types/', TransactionTypeListView.as_view(), name='transaction-types'),
    path('api/form-requests/', FormRequestListCreateView.as_view(), name='form-requests'),
    path('api/form-requests/<int:pk>/receipt/', FormRequestReceiptView.as_view(), name='form-request-receipt'),
    path('api/form-requests/<int:pk>/claim-stub/', FormRequestClaimStubView.as_view(), name='form-request-claim-stub'),
    # Lifecycle transitions: one endpoint per move, each checking the stage it is entered from.
    path('api/form-requests/<int:pk>/approve-log/', RegistrarApproveLogView.as_view(), name='form-request-approve-log'),
    path('api/form-requests/<int:pk>/mark-ready/', RegistrarMarkReadyView.as_view(), name='form-request-mark-ready'),
    path('api/form-requests/<int:pk>/release/', RegistrarReleaseView.as_view(), name='form-request-release'),
    path('api/registrar/dashboard/summary/', RegistrarDashboardSummaryView.as_view(), name='registrar-dashboard-summary'),
    path('api/registrar/dashboard/recent-submissions/', RegistrarRecentSubmissionsView.as_view(), name='registrar-recent-submissions'),
    path('api/registrar/dashboard/flagged/', RegistrarFlaggedRequestsView.as_view(), name='registrar-flagged'),
    path('api/registrar/dashboard/todays-pickups/', RegistrarTodaysPickupsView.as_view(), name='registrar-todays-pickups'),
    # View-only: counts for a month, then one day's list on demand.
    path('api/registrar/release-calendar/day/', RegistrarReleaseCalendarDayView.as_view(), name='registrar-release-calendar-day'),
    path('api/registrar/release-calendar/', RegistrarReleaseCalendarView.as_view(), name='registrar-release-calendar'),
    # Registered before the list route so "export" is never read as a filter value.
    path('api/registrar/released/export/', RegistrarReleasedExportView.as_view(), name='registrar-released-export'),
    path('api/registrar/released/', RegistrarReleasedListView.as_view(), name='registrar-released'),
    path('api/registrar/queue/', RegistrarQueueListView.as_view(), name='registrar-queue'),
    path('api/registrar/queue/<int:pk>/', RegistrarQueueDetailView.as_view(), name='registrar-queue-detail'),
    path('api/registrar/queue/<int:pk>/verify/', RegistrarQueueVerifyView.as_view(), name='registrar-queue-verify'),
    path('api/registrar/queue/<int:pk>/clear-flag/', RegistrarClearFlagView.as_view(), name='registrar-clear-flag'),
    path('api/registrar/queue/<int:pk>/approve/', RegistrarQueueApproveView.as_view(), name='registrar-queue-approve'),
    path('api/registrar/queue/<int:pk>/reject/', RegistrarQueueRejectView.as_view(), name='registrar-queue-reject'),
]

if settings.DEBUG:
    # Dev-only: serves uploaded files straight off disk.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
