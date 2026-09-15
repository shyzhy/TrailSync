from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AccountSetupConfirmView,
    AccountSetupValidateView,
    ActivateAccountView,
    LoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetValidateView,
    RegisterView,
    ResendActivationView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("activate/", ActivateAccountView.as_view(), name="auth-activate"),
    path("resend-activation/", ResendActivationView.as_view(), name="auth-resend-activation"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset/validate/", PasswordResetValidateView.as_view(), name="auth-password-reset-validate"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("account-setup/validate/", AccountSetupValidateView.as_view(), name="auth-account-setup-validate"),
    path("account-setup/confirm/", AccountSetupConfirmView.as_view(), name="auth-account-setup-confirm"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
]
