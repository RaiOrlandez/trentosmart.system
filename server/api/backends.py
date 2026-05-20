from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """
    Allows users to authenticate using either their email address or username.
    The frontend sends 'username' field containing the email address, so this
    backend checks both fields to find the correct user account.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None

        # Try to find user by email first (most common case from frontend)
        try:
            user = User.objects.get(email__iexact=username)
        except User.DoesNotExist:
            # Fall back to actual username lookup
            try:
                user = User.objects.get(username__iexact=username)
            except User.DoesNotExist:
                # No user found — run the default hasher to prevent timing attacks
                User().set_password(password)
                return None

        # Verify the password and that the user is allowed to authenticate
        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
