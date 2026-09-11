"""
URL configuration for BTrailSync project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from TrailSync.views import (
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
    RegistrarAssignableRequestsView,
    RegistrarAssignSlotView,
    RegistrarCreateReleaseSlotView,
    RegistrarDashboardSummaryView,
    RegistrarMarkReadyView,
    RegistrarQueueDetailView,
    RegistrarQueueListView,
    RegistrarQueueRejectView,
    RegistrarQueueVerifyView,
    RegistrarRecentSubmissionsView,
    RegistrarReleaseSlotCalendarView,
    RegistrarReleaseView,
    RegistrarReleaseSlotsForDateView,
    RegistrarTodaysReleaseSlotsView,
    ReleaseSlotListView,
    TransactionTypeListView,
    UpcomingReleaseDatesView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('TrailSync.urls')),
    path('api/me/', MeView.as_view(), name='me'),
    path('api/me/avatar/', MeAvatarView.as_view(), name='me-avatar'),
    path('api/me/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/me/change-email/request/', ChangeEmailRequestView.as_view(), name='change-email-request'),
    path('api/me/change-email/confirm/', ChangeEmailConfirmView.as_view(), name='change-email-confirm'),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/dashboard/recent-requests/', RecentFormRequestsView.as_view(), name='dashboard-recent-requests'),
    path('api/dashboard/upcoming-release-dates/', UpcomingReleaseDatesView.as_view(), name='dashboard-upcoming-release-dates'),
    path('api/transaction-types/', TransactionTypeListView.as_view(), name='transaction-types'),
    path('api/release-slots/', ReleaseSlotListView.as_view(), name='release-slots'),
    path('api/form-requests/', FormRequestListCreateView.as_view(), name='form-requests'),
    path('api/form-requests/<int:pk>/receipt/', FormRequestReceiptView.as_view(), name='form-request-receipt'),
    path('api/form-requests/<int:pk>/claim-stub/', FormRequestClaimStubView.as_view(), name='form-request-claim-stub'),
    # Lifecycle transitions - one endpoint per move, each validating the
    # stage it is entered from (see the views for why not a writable field).
    path('api/form-requests/<int:pk>/approve-log/', RegistrarApproveLogView.as_view(), name='form-request-approve-log'),
    path('api/form-requests/<int:pk>/mark-ready/', RegistrarMarkReadyView.as_view(), name='form-request-mark-ready'),
    path('api/form-requests/<int:pk>/release/', RegistrarReleaseView.as_view(), name='form-request-release'),
    path('api/registrar/dashboard/summary/', RegistrarDashboardSummaryView.as_view(), name='registrar-dashboard-summary'),
    path('api/registrar/dashboard/recent-submissions/', RegistrarRecentSubmissionsView.as_view(), name='registrar-recent-submissions'),
    path('api/registrar/dashboard/todays-release-slots/', RegistrarTodaysReleaseSlotsView.as_view(), name='registrar-todays-release-slots'),
    # Processing Queue
    path('api/registrar/queue/', RegistrarQueueListView.as_view(), name='registrar-queue'),
    path('api/registrar/queue/<int:pk>/', RegistrarQueueDetailView.as_view(), name='registrar-queue-detail'),
    path('api/registrar/queue/<int:pk>/verify/', RegistrarQueueVerifyView.as_view(), name='registrar-queue-verify'),
    path('api/registrar/queue/<int:pk>/approve/', RegistrarQueueApproveView.as_view(), name='registrar-queue-approve'),
    path('api/registrar/queue/<int:pk>/reject/', RegistrarQueueRejectView.as_view(), name='registrar-queue-reject'),
    # Release Slots — literal paths (calendar/, assignable-requests/, create/)
    # registered before the <int:pk> pattern so they aren't swallowed by it.
    path('api/registrar/release-slots/calendar/', RegistrarReleaseSlotCalendarView.as_view(), name='registrar-release-slots-calendar'),
    path('api/registrar/release-slots/assignable-requests/', RegistrarAssignableRequestsView.as_view(), name='registrar-assignable-requests'),
    path('api/registrar/release-slots/create/', RegistrarCreateReleaseSlotView.as_view(), name='registrar-release-slots-create'),
    path('api/registrar/release-slots/<int:pk>/assign/', RegistrarAssignSlotView.as_view(), name='registrar-release-slots-assign'),
    path('api/registrar/release-slots/', RegistrarReleaseSlotsForDateView.as_view(), name='registrar-release-slots-for-date'),
]

if settings.DEBUG:
    # Dev-only: serves uploaded files (e.g. the Board Exam photo) straight
    # off disk. A real deployment needs a proper file store in front of this.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
