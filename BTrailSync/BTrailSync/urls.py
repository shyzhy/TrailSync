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
    CreateFormRequestView,
    DashboardSummaryView,
    MeView,
    RecentFormRequestsView,
    ReleaseSlotListView,
    TransactionTypeListView,
    UpcomingReleaseDatesView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('TrailSync.urls')),
    path('api/me/', MeView.as_view(), name='me'),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/dashboard/recent-requests/', RecentFormRequestsView.as_view(), name='dashboard-recent-requests'),
    path('api/dashboard/upcoming-release-dates/', UpcomingReleaseDatesView.as_view(), name='dashboard-upcoming-release-dates'),
    path('api/transaction-types/', TransactionTypeListView.as_view(), name='transaction-types'),
    path('api/release-slots/', ReleaseSlotListView.as_view(), name='release-slots'),
    path('api/form-requests/', CreateFormRequestView.as_view(), name='form-requests'),
]

if settings.DEBUG:
    # Dev-only: serves uploaded files (e.g. the Board Exam photo) straight
    # off disk. A real deployment needs a proper file store in front of this.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
