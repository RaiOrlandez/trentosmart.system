from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Ride, Payment, Incident, WalletTransaction, Withdrawal, Review, Complaint, SavedPlace, SystemConfig, Broadcast, MaintenanceLog, LGURevenue
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

    class Meta:
        model = User
        fields = (
            'username', 'email', 'password', 'role', 'phone_number', 
            'address', 'date_of_birth', 'gender', 'emergency_contact_name'
        )

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
    def validate(self, attrs):
        data = super().validate(attrs)
        
        if not self.user.is_email_verified and self.user.role != 'admin':
            # Custom field for frontend to detect and show OTP screen
            raise serializers.ValidationError({
                'detail': 'Email not verified. Please check your email for the verification code.',
                'email_not_verified': True,
                'user_email': self.user.email
            })
            
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        token['email'] = user.email
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

