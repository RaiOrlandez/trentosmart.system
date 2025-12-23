from django.db import models
from rest_framework import viewsets, status, parsers, serializers
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import Ride, WalletTransaction, Withdrawal, Review, Incident, Complaint, SystemConfig, SavedPlace, Broadcast, MaintenanceLog
from .serializers import (
    UserSerializer, RegisterSerializer, RideSerializer, 
    DriverVerificationSerializer, WalletTransactionSerializer, WithdrawalSerializer,
    ReviewSerializer, IncidentSerializer, ComplaintSerializer, CustomTokenObtainPairSerializer,
    SavedPlaceSerializer, SystemConfigSerializer, BroadcastSerializer, MaintenanceLogSerializer
)
from decimal import Decimal
from .notifications import send_sms, send_push_notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .fraud_service import FraudDetectionService
from django.contrib.auth.hashers import make_password, check_password
from .models import TransactionPIN

User = get_user_model()


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        
        # Broadcast to admins/system
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'new_user_signup',
                'user': {
                    'username': user.username,
                    'role': user.role,
                    'date_joined': user.date_joined.isoformat() if user.date_joined else None
                }
            }
        )
        
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = CustomTokenObtainPairSerializer
    

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only admins can see all users
        if self.request.user.role == 'admin':
            return self.queryset
        # Users can only see themselves (though usually handled by ProfileView)
        return self.queryset.filter(id=self.request.user.id)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def approve_driver(self, request, pk=None):
        if request.user.role != 'admin':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        user = self.get_object()
        if user.role != 'driver':
            return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
        
        user.is_verified_driver = True
        user.save()

        # Broadcast event to system
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'driver_verified',
                    'message': f"Driver {user.username} has been verified!",
                    'user_id': user.id,
                    'timestamp': timezone.now().isoformat()
                }
            }
        )
        
        send_push_notification(
            user,
            "Driver Account Verified ✅",
            "Congratulations! You are now authorized to accept rides."
        )
        return Response({'status': 'verified', 'is_verified_driver': True})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def update_location(self, request):
        if request.user.role != 'driver':
            return Response({'detail': 'Only drivers can update location'}, status=status.HTTP_403_FORBIDDEN)
        
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        
        if lat is None or lng is None:
            return Response({'detail': 'Latitude and Longitude are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user
        user.last_lat = lat
        user.last_lng = lng
        user.last_location_update = timezone.now()
        user.save()
        
        # Broadcast location to system (for Admin Live Map & Passengers)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'driver_location_update',
                'driver_id': user.id,
                'username': user.username,
                'lat': float(lat),
                'lng': float(lng),
                'status': 'Available' # Simplified for global view
            }
        )
        
        return Response({'status': 'location updated'})



class RideViewSet(viewsets.ModelViewSet):
    queryset = Ride.objects.all().order_by('-requested_at')
    serializer_class = RideSerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        ride = serializer.save(passenger=self.request.user)
        
        # Broadcast new ride to all drivers
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'new_ride_request',
                'ride': RideSerializer(ride).data
            }
        )

    def perform_update(self, serializer):
        # Fetch original instance to compare status
        instance = self.get_object()
        old_status = instance.status
        
        updated_ride = serializer.save()
        new_status = updated_ride.status
        
        if old_status != new_status:
            # Broadcast status update to ride group
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'ride_{updated_ride.id}',
                {
                    'type': 'ride_status_update',
                    'status': new_status,
                    'data': RideSerializer(updated_ride).data
                }
            )

            # Broadcast to Admin Activity Feed
            async_to_sync(channel_layer.group_send)(
                'global_system',
                {
                    'type': 'system_event',
                    'event': {
                        'type': 'ride_activity',
                        'message': f"Ride #{updated_ride.id} status changed to {new_status.replace('_', ' ').upper()}",
                        'ride_id': updated_ride.id,
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )

            if new_status == 'on_route':
                send_push_notification(
                    updated_ride.passenger,
                    "Driver is On the Way! 🏁",
                    "Your ride has officially started. Enjoy the trip!"
                )
            elif new_status == 'completed':
                fare = updated_ride.fare or 0
                send_push_notification(
                    updated_ride.passenger,
                    "Ride Completed ✅",
                    f"You have arrived! Total fare is ₱{fare}. Please pay via {updated_ride.payment.method if hasattr(updated_ride, 'payment') else 'Cash'}."
                )
            elif new_status == 'cancelled':
                # Notify the other party
                recipient = updated_ride.driver if self.request.user == updated_ride.passenger else updated_ride.passenger
                if recipient:
                    send_push_notification(
                        recipient,
                        "Ride Cancelled ❌",
                        f"The ride was cancelled by {self.request.user.username}."
                    )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_rides(self, request):
        if request.user.role == 'driver':
            qs = Ride.objects.filter(driver=request.user)
        else:
            qs = Ride.objects.filter(passenger=request.user)
        ser = RideSerializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=['get'])
    def estimate_fare(self, request):
        # AI Fare Elasticity Logic powered by SystemConfig
        base_fare_cfg = SystemConfig.objects.filter(key='base_fare').first()
        base_fare = float(base_fare_cfg.value) if base_fare_cfg else 30.00
        
        per_km_cfg = SystemConfig.objects.filter(key='rate_per_km').first()
        rate_per_km = float(per_km_cfg.value) if per_km_cfg else 8.00
        
        surge_threshold_cfg = SystemConfig.objects.filter(key='surge_threshold').first()
        surge_threshold = float(surge_threshold_cfg.value) if surge_threshold_cfg else 1.5

        active_rides_count = Ride.objects.filter(status__in=['pending', 'matched', 'ongoing']).count()
        available_drivers_count = get_user_model().objects.filter(role='driver', is_verified_driver=True).count()
        
        ratio = active_rides_count / available_drivers_count if available_drivers_count > 0 else 1.0
        
        surge_multiplier_cfg = SystemConfig.objects.filter(key='surge_multiplier').first()
        default_surge = float(surge_multiplier_cfg.value) if surge_multiplier_cfg else 1.2
        
        surge_multiplier = 1.0
        if ratio > surge_threshold: surge_multiplier = default_surge
        if ratio > surge_threshold * 1.5: surge_multiplier = default_surge * 1.25
        if ratio > surge_threshold * 2.5: surge_multiplier = default_surge * 1.6

        return Response({
            'base_fare': base_fare,
            'rate_per_km': rate_per_km,
            'surge_multiplier': surge_multiplier,
            'is_surge': surge_multiplier > 1.0,
            'reason': 'High demand' if surge_multiplier > 1.0 else 'Normal demand'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def driver_requests(request):
    # Return nearby or pending requests for the authenticated driver
    if request.user.role != 'driver':
        return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    qs = Ride.objects.filter(status='requested').order_by('requested_at')[:20]
    ser = RideSerializer(qs, many=True)
    return Response(ser.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def driver_accept(request, ride_id):
    if request.user.role != 'driver':
        return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    ride = get_object_or_404(Ride, id=ride_id)
    if ride.status != 'requested':
        return Response({'detail': 'Ride not available'}, status=status.HTTP_400_BAD_REQUEST)
    ride.driver = request.user
    ride.status = 'accepted'
    ride.accepted_at = timezone.now()
    ride.save()
    
    # Notify passenger via Push
    send_push_notification(
        ride.passenger, 
        "Ride Accepted! 🛺", 
        f"Driver {request.user.username} is on the way to pick you up at {ride.pickup_address}."
    )
    
    # Notify passenger via WebSocket
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'ride_{ride.id}',
        {
            'type': 'ride_status_update',
            'status': 'accepted',
            'data': RideSerializer(ride).data
        }
    )
    
    return Response(RideSerializer(ride).data)


class DriverVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        if request.user.role != 'driver':
            return Response({'detail': 'Only drivers can submit verification documents.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = DriverVerificationSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            # If they update documents, they need to be re-verified
            user.is_verified_driver = False
            user.save()
            
            send_push_notification(
                request.user,
                "Verification Submitted 📄",
                "Your documents have been received. Please wait for admin re-approval."
            )
            return Response({'detail': 'Documents submitted successfully. Waiting for admin approval.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DriverAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'driver':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate earnings
        today = timezone.now().date()
        week_start = today - timezone.timedelta(days=today.weekday())
        
        rides = Ride.objects.filter(driver=request.user, status='completed')
        
        today_earnings = sum(r.fare for r in rides.filter(completed_at__date=today)) if rides.exists() else 0
        week_earnings = sum(r.fare for r in rides.filter(completed_at__date__gte=week_start)) if rides.exists() else 0
        total_earnings = sum(r.fare for r in rides) if rides.exists() else 0
        
        # Last 7 days chart data
        chart_data = []
        for i in range(6, -1, -1):
            date = today - timezone.timedelta(days=i)
            day_earnings = sum(r.fare for r in rides.filter(completed_at__date=date))
            chart_data.append({
                'day': date.strftime('%a'),
                'amount': day_earnings
            })
            
        return Response({
            'today': today_earnings,
            'week': week_earnings,
            'total': total_earnings,
            'trips_count': rides.count(),
            'chart_data': chart_data
        })


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        transactions = WalletTransaction.objects.filter(user=request.user).order_by('-created_at')
        ser = WalletTransactionSerializer(transactions, many=True)
        return Response({
            'balance': request.user.wallet_balance,
            'transactions': ser.data
        })

    @action(detail=False, methods=['post'])
    def topup(self, request):
        amount = request.data.get('amount')
        if not amount:
            return Response({'detail': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amt = float(amount)
            if amt <= 0: raise ValueError
        except ValueError:
            return Response({'detail': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        user.wallet_balance += amt
        user.save()

        WalletTransaction.objects.create(
            user=user,
            amount=amt,
            transaction_type='topup',
            description='Wallet Top-up'
        )
        send_push_notification(
            user,
            "Wallet Loaded 💰",
            f"Successfully added ₱{amt} to your Smart Wallet. New Balance: ₱{user.wallet_balance}."
        )
        return Response({'balance': user.wallet_balance})

    @action(detail=False, methods=['post'])
    def pay(self, request):
        amount = request.data.get('amount')
        pin_code = request.data.get('pin_code')

        if not pin_code:
            return Response({'detail': 'Transaction PIN is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            pin_obj = TransactionPIN.objects.get(user=request.user)
            if not check_password(pin_code, pin_obj.pin_hash):
                 return Response({'detail': 'Invalid Security PIN'}, status=status.HTTP_400_BAD_REQUEST)
        except TransactionPIN.DoesNotExist:
             return Response({'detail': 'No Transaction PIN set'}, status=status.HTTP_400_BAD_REQUEST)

        if not amount:
            return Response({'detail': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amt = float(amount)
            if amt <= 0: raise ValueError
        except ValueError:
            return Response({'detail': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        if user.wallet_balance < amt:
            return Response({'detail': 'Insufficient balance in your Smart Wallet.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user.wallet_balance -= amt
        user.save()

        WalletTransaction.objects.create(
            user=user,
            amount=amt,
            transaction_type='payment',
            description='Ride Payment'
        )
        send_push_notification(
            user,
            "Payment Successful 💸",
            f"Paid ₱{amt} using Smart Wallet. Remaining Balance: ₱{user.wallet_balance}."
        )
        return Response({'balance': user.wallet_balance})


class PINManagementView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        has_pin = TransactionPIN.objects.filter(user=request.user).exists()
        return Response({'has_pin': has_pin})

    def post(self, request):
        # Set New PIN
        pin = request.data.get('pin')
        if not pin or len(pin) != 6 or not pin.isdigit():
            return Response({'detail': 'PIN must be exactly 6 digits.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already exists
        if TransactionPIN.objects.filter(user=request.user).exists():
            return Response({'detail': 'PIN already set. Use update endpoint.'}, status=status.HTTP_400_BAD_REQUEST)
        
        TransactionPIN.objects.create(
            user=request.user,
            pin_hash=make_password(pin)
        )
        return Response({'detail': 'Security PIN successfully set!'}, status=status.HTTP_201_CREATED)

    def put(self, request):
        # Update existing PIN
        old_pin = request.data.get('old_pin')
        new_pin = request.data.get('new_pin')

        if not new_pin or len(new_pin) != 6 or not new_pin.isdigit():
            return Response({'detail': 'New PIN must be 6 digits.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pin_obj = TransactionPIN.objects.get(user=request.user)
            if not check_password(old_pin, pin_obj.pin_hash):
                return Response({'detail': 'Old PIN is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
            
            pin_obj.pin_hash = make_password(new_pin)
            pin_obj.save()
            return Response({'detail': 'Security PIN updated.'})
        except TransactionPIN.DoesNotExist:
            return Response({'detail': 'No PIN found to update.'}, status=status.HTTP_404_NOT_FOUND)


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewSerializer

    def get_queryset(self):
        return Review.objects.filter(passenger=self.request.user)

    def perform_create(self, serializer):
        ride_id = self.request.data.get('ride')
        ride = get_object_or_404(Ride, id=ride_id)
        if ride.passenger != self.request.user:
            raise serializers.ValidationError("You can only review rides you were a passenger of.")
        if not ride.driver:
            raise serializers.ValidationError("This ride has no assigned driver.")
        
        serializer.save(
            passenger=self.request.user,
            driver=ride.driver,
            ride=ride
        )


class WithdrawalViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawalSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Withdrawal.objects.all().order_by('-created_at')
        return Withdrawal.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        
        # Security: Verify PIN before processing withdrawal
        pin_code = self.request.data.get('pin_code')
        if not pin_code:
            raise serializers.ValidationError("Transaction PIN is required.")
        
        try:
            pin_obj = TransactionPIN.objects.get(user=user)
            if not check_password(pin_code, pin_obj.pin_hash):
                raise serializers.ValidationError("Invalid Security PIN.")
        except TransactionPIN.DoesNotExist:
             raise serializers.ValidationError("Please set up your Transaction PIN first.")

        amount_str = self.request.data.get('amount', '0')
        try:
            amount = Decimal(str(amount_str))
        except:
            raise serializers.ValidationError("Invalid amount")
            
        if amount <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
            
        if amount > user.wallet_balance:
            raise serializers.ValidationError("Insufficient wallet balance.")
            
        # Fraud Check
        if FraudDetectionService.check_withdrawal_velocity(user, float(amount)):
             raise serializers.ValidationError("Security Alert: Unusual withdrawal activity detected. Account temporarily flagged.")

        # Deduct from balance immediately on request to "lock" it
        user.wallet_balance -= amount
        user.save()
        
        # Log the transaction
        WalletTransaction.objects.create(
            user=user,
            amount=amount,
            transaction_type='cashout',
            description=f"Withdrawal to {self.request.data.get('method', 'GCash')}"
        )
        
        withdrawal = serializer.save(user=user)
        
        # Broadcast to Admin Activity Feed
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'withdrawal_request',
                    'message': f"Withdrawal Requested: {user.username} (₱{amount})",
                    'timestamp': withdrawal.created_at.isoformat()
                }
            }
        )
        
        send_push_notification(
            user,
            "Withdrawal Requested 📤",
            f"Your request to withdraw ₱{amount} has been received and is being processed."
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        withdrawal = serializer.save()
        new_status = withdrawal.status

        if old_status != new_status:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'global_system',
                {
                    'type': 'system_event',
                    'event': {
                        'type': 'withdrawal_update',
                        'message': f"Withdrawal for {withdrawal.user.username} {new_status.upper()}",
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )


class IncidentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = IncidentSerializer

    def get_queryset(self):
        return Incident.objects.all().order_by('-created_at')

    def perform_create(self, serializer):
        incident = serializer.save(user=self.request.user)
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_emergency_alert',
                'id': incident.id,
                'user': incident.user.username,
                'type_label': 'EMERGENCY SOS',
                'lat': float(incident.lat) if incident.lat else 8.314,
                'lng': float(incident.lng) if incident.lng else 125.899,
                'description': incident.description,
                'time': 'Just now'
            }
        )
        
        # Send SMS Alert to Emergency Contact
        if incident.user.emergency_contact_phone:
            message = (
                f"🚨 EMERGENCY: {incident.user.username} has triggered an SOS alert! "
                f"Location: Trento. Follow live tracking on the Smart Dispatch System."
            )
            send_sms(incident.user.emergency_contact_phone, message)


class ComplaintViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Complaint.objects.all().order_by('-created_at')
        return Complaint.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        complaint = serializer.save(user=self.request.user)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'safety_alert',
                    'message': f"New Complaint from {self.request.user.username}: {complaint.subject}",
                    'timestamp': timezone.now().isoformat()
                }
            }
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        complaint = serializer.save()
        if old_status != complaint.status:
             channel_layer = get_channel_layer()
             async_to_sync(channel_layer.group_send)(
                'global_system',
                {
                    'type': 'system_event',
                    'event': {
                        'type': 'safety_update',
                        'message': f"Complaint #{complaint.id} status changed to {complaint.status}",
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Review.objects.all().order_by('-created_at')
        # Users see reviews they received
        return Review.objects.filter(reviewee=user).order_by('-created_at')

    def perform_create(self, serializer):
        # Get the ride
        ride_id = self.request.data.get('ride')
        
        if not ride_id:
            raise serializers.ValidationError({"ride": "Ride ID is required."})
        
        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            raise serializers.ValidationError({"ride": f"Ride with ID {ride_id} does not exist."})
        
        # Check if user is passenger or driver
        is_passenger = ride.passenger == self.request.user
        is_driver = ride.driver == self.request.user

        if not is_passenger and not is_driver:
            raise serializers.ValidationError({"detail": "You can only review rides you were involved in."})
        
        # Ensure the ride has both parties
        if not ride.driver or not ride.passenger:
            raise serializers.ValidationError({"detail": "This ride does not have both a passenger and a driver."})
        
        # Ensure the ride is completed
        if ride.status != 'completed':
            raise serializers.ValidationError({"detail": f"You can only review completed rides. This ride status is: {ride.status}"})
        
        # Determine reviewer and reviewee
        reviewer = self.request.user
        reviewee = ride.driver if is_passenger else ride.passenger

        # Check if THIS reviewer has already reviewed this ride
        if Review.objects.filter(ride=ride, reviewer=reviewer).exists():
            raise serializers.ValidationError({"detail": "You have already reviewed this ride."})
        
        # Save the review
        review = serializer.save(
            reviewer=reviewer,
            reviewee=reviewee
        )

        # Broadcast to Admin Activity Feed
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'review_posted',
                    'message': f"New {review.rating}-Star Review by {reviewer.username} for {reviewee.username}",
                    'timestamp': timezone.now().isoformat()
                }
            }
        )


class SavedPlaceViewSet(viewsets.ModelViewSet):
    serializer_class = SavedPlaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedPlace.objects.filter(user=self.request.user).order_by('category')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SystemConfigViewSet(viewsets.ModelViewSet):
    queryset = SystemConfig.objects.all()
    serializer_class = SystemConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        # In a real app, only Admins should be able to update
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        config = serializer.save()
        
        # Broadcast via WebSockets
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'config_update',
                    'config': SystemConfigSerializer(config).data,
                    'message': f"System Policy Updated: {config.key.replace('_', ' ').title()} is now {config.value}",
                    'timestamp': timezone.now().isoformat()
                }
            }
        )


class BroadcastViewSet(viewsets.ModelViewSet):
    queryset = Broadcast.objects.all()
    serializer_class = BroadcastSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Broadcast.objects.all().order_by('-created_at')
        return Broadcast.objects.filter(
            models.Q(target_role='all') | models.Q(target_role=user.role)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        broadcast = serializer.save(user=self.request.user)
        
        # Broadcast via WebSockets
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'system_event',
                'event': {
                    'type': 'new_broadcast',
                    'broadcast': BroadcastSerializer(broadcast).data,
                    'message': f"New {broadcast.target_role} Announcement: {broadcast.title}",
                    'timestamp': broadcast.created_at.isoformat()
                }
            }
        )

class MaintenanceLogViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return MaintenanceLog.objects.all().order_by('-service_date')
        return MaintenanceLog.objects.filter(user=user).order_by('-service_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
