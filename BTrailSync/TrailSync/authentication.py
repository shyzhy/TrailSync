"""JWT authentication that also honours User.status, so suspending an account ends its sessions."""
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


def active_account_rule(user):
    """Used by simplejwt at login and token refresh: the account must exist, be active, and not be suspended."""
    return user is not None and user.is_active and user.status == "Active"


class StatusAwareJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.status != "Active":
            raise AuthenticationFailed("This account is suspended.", code="user_suspended")
        return user
