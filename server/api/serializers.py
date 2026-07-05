from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Ride, Payment, Incident, WalletTransaction, Withdrawal, Review, Complaint,
    SavedPlace, SystemConfig, Broadcast, MaintenanceLog, LGURevenue, ActivityLog,
    ScheduledRide,
)


class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = '__all__'


class BroadcastSerializer(serializers.ModelSerializer):
    class Meta:
        model = Broadcast
        fields = '__all__'
        read_only_fields = ('user', 'created_at')


class SavedPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedPlace
        fields = '__all__'
        read_only_fields = ('user', 'created_at')

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    license_image_url = serializers.SerializerMethodField()
    permit_image_url = serializers.SerializerMethodField()
    nbi_clearance_image_url = serializers.SerializerMethodField()
    barangay_residency_image_url = serializers.SerializerMethodField()
    government_id_image_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'role', 'phone_number', 
            'emergency_contact_phone', 'emergency_contact_name', 'is_verified_driver', 'verification_status', 'wallet_balance', 
            'average_rating', 'vehicle_model', 'vehicle_color', 
            'sidecar_type', 'vehicle_plate', 'last_lat', 'last_lng',
            'license_number', 'license_image', 'license_image_url',
            'permit_number', 'permit_image', 'permit_image_url',
            'verification_notes', 'date_joined', 'address', 'date_of_birth', 'profile_picture',
            'profile_picture_url',
            'gender', 'body_number', 'license_expiry_date',
            'nbi_clearance_image', 'nbi_clearance_image_url',
            'barangay_residency_image', 'barangay_residency_image_url',
            'government_id_image', 'government_id_image_url',
            'auto_accept_rides', 'receive_notifications', 'search_radius_km',
            'is_online'
        )

    def _build_url(self, obj, field_name):
        """Build absolute URL for any image field, works with both local and Cloudinary storage."""
        request = self.context.get('request')
        field = getattr(obj, field_name, None)
        if not field:
            return None
        try:
            url = field.url
        except Exception:
            return None
        # If already an absolute URL (Cloudinary), return as-is
        if url.startswith('http'):
            return url
        # Otherwise build absolute URL from request
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_profile_picture_url(self, obj):
        return self._build_url(obj, 'profile_picture')

    def get_license_image_url(self, obj):
        return self._build_url(obj, 'license_image')

    def get_permit_image_url(self, obj):
        return self._build_url(obj, 'permit_image')

    def get_nbi_clearance_image_url(self, obj):
        return self._build_url(obj, 'nbi_clearance_image')

    def get_barangay_residency_image_url(self, obj):
        return self._build_url(obj, 'barangay_residency_image')

    def get_government_id_image_url(self, obj):
        return self._build_url(obj, 'government_id_image')


class DriverVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('license_number', 'license_image', 'permit_number', 'permit_image', 'nbi_clearance_image', 'barangay_residency_image')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    # Trusted email domains (must match frontend whitelist)
    ALLOWED_EMAIL_DOMAINS = [
        'gmail.com',
        'yahoo.com', 'yahoo.com.ph', 'yahoo.co.uk', 'yahoo.co.jp',
        'ymail.com', 'rocketmail.com',
        'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
        'icloud.com', 'me.com', 'mac.com',
        'protonmail.com', 'proton.me', 'zoho.com', 'aol.com',
        'mail.com', 'gmx.com', 'tutanota.com',
    ]

    class Meta:
        model = User
        fields = (
            'username', 'email', 'password', 'role', 'phone_number', 
            'address', 'date_of_birth', 'gender', 'emergency_contact_name'
        )

    def validate_email(self, value):
        """Only accept emails from trusted providers or institutional domains."""
        if not value or '@' not in value:
            raise serializers.ValidationError("A valid email address is required.")
        domain = value.split('@')[1].lower()
        is_allowed = (
            domain in self.ALLOWED_EMAIL_DOMAINS
            or domain.endswith('.edu') or domain.endswith('.edu.ph')
            or domain.endswith('.gov') or domain.endswith('.gov.ph')
        )
        if not is_allowed:
            raise serializers.ValidationError(
                f"\"@{domain}\" is not accepted. Please use Gmail, Yahoo, Outlook, or a school/government email."
            )
        return value.lower()

    def create(self, validated_data):
        user = User(
            username=validated_data['username'], 
            email=validated_data.get('email'), 
            role=validated_data.get('role', 'passenger'),
            phone_number=validated_data.get('phone_number', ''),
            address=validated_data.get('address', ''),
            date_of_birth=validated_data.get('date_of_birth'),
            gender=validated_data.get('gender', ''),
            emergency_contact_name=validated_data.get('emergency_contact_name', '')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class RideSerializer(serializers.ModelSerializer):
    passenger = UserSerializer(read_only=True)
    driver = UserSerializer(read_only=True)
    targeted_driver = UserSerializer(read_only=True)
    payment_method = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = '__all__'
        read_only_fields = ('requested_at', 'accepted_at', 'started_at', 'completed_at', 'share_token')

    def get_payment_method(self, obj):
        try:
            return obj.payment.method
        except:
            return "cash"


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = '__all__'


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = '__all__'


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    reviewee = UserSerializer(read_only=True)
    ride = RideSerializer(read_only=True)
    
    class Meta:
        model = Review
        fields = '__all__'
        read_only_fields = ('reviewer', 'reviewee', 'created_at')
class WithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Withdrawal
        fields = '__all__'
        read_only_fields = ('user', 'status', 'reference_id', 'created_at', 'updated_at')


class ComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = '__all__'
        read_only_fields = ('user', 'created_at')


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': 'Invalid email/username or password.',
    }

    def validate(self, attrs):
        identifier = (attrs.get('username') or attrs.get('email') or '').strip()
        if not identifier:
            raise serializers.ValidationError({'detail': 'Email or username is required.'})
        attrs['username'] = identifier
        attrs['email'] = identifier

        try:
            data = super().validate(attrs)
        except serializers.ValidationError:
            raise serializers.ValidationError({'detail': 'Invalid email/username or password.'})

        # Block unverified passengers/drivers; admins may always sign in
        user = self.user
        if user.role != 'admin' and not getattr(user, 'is_email_verified', True):
            raise serializers.ValidationError({
                'detail': 'Please verify your email before logging in.',
                'email_not_verified': True,
            })

        return data

    @classmethod
    def get_token(cls, user):
        import uuid
        # Generate new session salt on login to invalidate all other active sessions!
        user.jwt_session_salt = uuid.uuid4().hex
        user.save(update_fields=['jwt_session_salt'])

        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        token['email'] = user.email
        token['jwt_session_salt'] = user.jwt_session_salt
        token['is_verified_driver'] = user.is_verified_driver
        token['verification_status'] = user.verification_status
        if user.profile_picture:
            token['profile_picture'] = user.profile_picture.url
        else:
            token['profile_picture'] = None
        return token

class MaintenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceLog
        fields = '__all__'
        read_only_fields = ('user', 'created_at')


class LGURevenueSerializer(serializers.ModelSerializer):
    ride_details = RideSerializer(source='ride', read_only=True)
    
    class Meta:
        model = LGURevenue
        fields = '__all__'
        read_only_fields = ('collected_at',)


class ActivityLogSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ('created_at',)


class ScheduledRideSerializer(serializers.ModelSerializer):
    """Serializer for passenger scheduled rides. passenger is auto-set from request.user."""
    passenger_username = serializers.CharField(source='passenger.username', read_only=True)

    class Meta:
        model = ScheduledRide
        fields = '__all__'
        read_only_fields = ('passenger', 'status', 'ride', 'created_at', 'updated_at')


from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Custom refresh token serializer that validates the session salt.
    Prevents refresh token loops and handles single session invalidation immediately.
    """
    def validate(self, attrs):
        # Retrieve the original validation data (which checks signature/expiration)
        try:
            data = super().validate(attrs)
        except InvalidToken as e:
            raise e

        # Decode the refresh token to get user_id and session salt
        try:
            refresh = RefreshToken(attrs['refresh'])
            user_id = refresh.payload.get('user_id')
            token_salt = refresh.payload.get('jwt_session_salt')

            User = get_user_model()
            user = User.objects.get(id=user_id)

            # Enforce single session validation on refresh
            if user.role != 'admin' and token_salt:
                if getattr(user, 'jwt_session_salt', None) != token_salt:
                    raise InvalidToken('Your session has expired because you logged in on another device.')
        except Exception as e:
            if isinstance(e, InvalidToken):
                raise e
            raise InvalidToken('Invalid refresh token or session has expired.')

        return data

