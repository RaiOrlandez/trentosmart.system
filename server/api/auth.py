from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

class JWTDeviceSessionAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication backend that enforces single-device session.
    It checks if the jwt_session_salt in the token payload matches the one in the database.
    If they don't match, it means another login has occurred, rendering this session invalid.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        
        # Check if jwt_session_salt claim is in the token
        token_salt = validated_token.get('jwt_session_salt')
        
        # Skip validation if the user is an admin or if jwt_session_salt is not set (backwards compatibility)
        if user and user.role != 'admin' and token_salt:
            if getattr(user, 'jwt_session_salt', None) != token_salt:
                raise AuthenticationFailed(
                    'Your account has been logged in from another device. Please sign in again.',
                    code='concurrent_login'
                )
            
        return user
