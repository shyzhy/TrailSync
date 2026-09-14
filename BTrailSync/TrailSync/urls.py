from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import ActivateAccountView, LoginView, RegisterView, ResendActivationView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("activate/", ActivateAccountView.as_view(), name="auth-activate"),
    path("resend-activation/", ResendActivationView.as_view(), name="auth-resend-activation"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
]
