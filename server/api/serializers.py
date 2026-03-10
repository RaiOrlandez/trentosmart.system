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

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'role', 'phone_number', 
            'emergency_contact_phone', 'emergency_contact_name', 'is_verified_driver', 'wallet_balance', 
            'average_rating', 'vehicle_model', 'vehicle_color', 
            'sidecar_type', 'vehicle_plate', 'last_lat', 'last_lng',
            'license_number', 'license_image', 'permit_number', 'permit_image',
            'verification_notes', 'date_joined', 'address', 'date_of_birth', 'profile_picture',
            'profile_picture_url',
            'gender', 'body_number', 'license_expiry_date', 'nbi_clearance_image', 
            'barangay_residency_image', 'government_id_image',
            'auto_accept_rides', 'receive_notifications', 'search_radius_km',
            'is_online'
        )

    def get_profile_picture_url(self, obj):
        """Return a fully absolute URL for the profile picture."""
        request = self.context.get('request')
        if obj.profile_picture:
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None


class DriverVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('license_number', 'license_image', 'permit_number', 'permit_image')


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
        read_only_fields = ('status', 'requested_at', 'accepted_at', 'started_at', 'completed_at', 'share_token')

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
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        token['email'] = user.email
        token['is_verified_driver'] = user.is_verified_driver
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

