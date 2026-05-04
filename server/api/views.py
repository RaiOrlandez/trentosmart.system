from django.db import models
import math
from rest_framework import viewsets, status, parsers, serializers
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from .models import Ride, WalletTransaction, Withdrawal, Review, Incident, Complaint, SystemConfig, SavedPlace, Broadcast, MaintenanceLog, Payment
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


def calculate_distance(lat1, lng1, lat2, lng2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    R = 6371  # Radius of earth in km
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLng/2) * math.sin(dLng/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = R * c
    return d


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()

        # ── Fire all post-registration notifications in the background ────────
        # This ensures the API returns immediately (< 200ms) without waiting
        # for SMTP connections which can take 5-10 seconds each.
        import threading
        from django.core.mail import send_mail
        from django.conf import settings as django_settings

        def send_notifications(username, email, role, date_joined):
            # Welcome Email
            try:
                send_mail(
                    subject='Welcome to Trento Smart Tricycle System! 🛺',
                    message=f"""Hi {username},

Welcome to the Trento Smart Tricycle System!

Your account has been successfully created.

Account Details:
  Username : {username}
  Email    : {email}
  Role     : {role.capitalize()}

{"Your driver account is currently pending verification. The admin will review your documents and approve your account shortly." if role == 'driver' else "You can now log in and start booking rides!"}

If you did not create this account, please contact us immediately.

Best regards,
Trento Smart System Team
""",
                    from_email=django_settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                )
            except Exception as e:
                print(f"[Email] Welcome email failed: {e}")

            # Admin Notification Email
            try:
                admin_email = django_settings.ADMIN_NOTIFICATION_EMAIL
                if admin_email:
                    send_mail(
                        subject=f'🆕 New {role.capitalize()} Registered — {username}',
                        message=f"""A new user has registered on the Trento Smart System.

User Details:
  Username  : {username}
  Email     : {email}
  Role      : {role.capitalize()}
  Joined At : {date_joined.strftime('%B %d, %Y at %I:%M %p') if date_joined else 'N/A'}
  {"⚠️  This driver account requires your verification approval." if role == 'driver' else ""}

Log in to the Admin Dashboard to manage this user:
https://trentosmartsystem-production.up.railway.app/admin/

— Trento Smart Automated System
""",
                        from_email=django_settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=True,
                    )
            except Exception as e:
                print(f"[Email] Admin notification failed: {e}")

            # WebSocket Broadcast
            try:
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    'global_system',
                    {
                        'type': 'new_user_signup',
                        'user': {
                            'username': username,
                            'role': role,
                            'date_joined': date_joined.isoformat() if date_joined else None
                        }
                    }
                )
            except Exception as ws_err:
                print(f"[WebSocket] Broadcast failed (non-critical): {ws_err}")

        thread = threading.Thread(
            target=send_notifications,
            args=(user.username, user.email, user.role, user.date_joined),
            daemon=True
        )
        thread.start()

        return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)




class CheckEmailView(APIView):
    permission_classes = (AllowAny,)
    def get(self, request):
        email = request.query_params.get('email', '')
        if not email:
            return Response({'error': 'Email is required'}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({'available': not exists})

class CheckUsernameView(APIView):
    permission_classes = (AllowAny,)
    def get(self, request):
        username = request.query_params.get('username', '')
        if not username:
            return Response({'error': 'Username is required'}, status=400)
        exists = User.objects.filter(username__iexact=username).exists()
        return Response({'available': not exists})

class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = CustomTokenObtainPairSerializer
    

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        print("Profile Update Error:", serializer.errors)
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

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            print(f"Delete request from {request.user.username} (Role: {request.user.role}) for user {instance.username}")

            # Strict permission check
            if request.user.role != 'admin' and request.user.id != instance.id:
                return Response({'detail': 'Forbidden: You can only delete your own account.'}, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent deleting yourself if you are an admin (safety)
            if request.user.role == 'admin' and request.user.id == instance.id:
                 # Check if there are other admins? For now, just warn or allow with caution
                 # Allowing self-delete for admins is dangerous, maybe block it?
                 print("Admin attempting to delete themselves - WARNING")
                 # Uncomment to block: return Response({'detail': 'Cannot delete your own admin account.'}, status=status.HTTP_400_BAD_REQUEST)

            self.perform_destroy(instance)
            print(f"User {instance.username} deleted successfully")
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            print(f"Error deleting user: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'detail': f'Failed to delete user: {str(e)}',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def approve_driver(self, request, pk=None):
        try:
            print(f"Driver approval request from admin: {request.user.username} for user ID: {pk}")
            
            if request.user.role != 'admin':
                print(f"Permission denied: {request.user.username} is not an admin")
                return Response({'detail': 'Forbidden - Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            user = self.get_object()
            print(f"Approving driver: {user.username} (ID: {user.id})")
            
            if user.role != 'driver':
                print(f"User {user.username} is not a driver, role: {user.role}")
                return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.is_verified_driver = True
            user.verification_status = 'approved'
            user.save()
            print(f"Driver {user.username} verified successfully")

            # Broadcast event to system (non-blocking)
            try:
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
            except Exception as broadcast_err:
                print(f"Broadcast failed (non-critical): {broadcast_err}")
            
            # Send notification (non-blocking)
            try:
                send_push_notification(
                    user,
                    "Driver Account Verified ✅",
                    "Congratulations! You are now authorized to accept rides."
                )
            except Exception as notif_err:
                print(f"Notification failed (non-critical): {notif_err}")
            
            return Response({
                'status': 'verified',
                'is_verified_driver': True,
                'detail': f'Driver {user.username} verified successfully'
            })
            
        except Exception as e:
            print(f"Error approving driver: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'detail': f'Failed to approve driver: {str(e)}',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reject_driver(self, request, pk=None):
        try:
            if request.user.role != 'admin': return Response({'detail': 'Forbidden - Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            user = self.get_object()
            if user.role != 'driver': return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_verified_driver = False
            user.verification_status = 'rejected'
            user.save()
            return Response({'status': 'rejected', 'detail': f'Driver {user.username} rejected'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def suspend_driver(self, request, pk=None):
        try:
            if request.user.role != 'admin': return Response({'detail': 'Forbidden - Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            user = self.get_object()
            if user.role != 'driver': return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_verified_driver = False
            user.verification_status = 'suspended'
            user.save()
            return Response({'status': 'suspended', 'detail': f'Driver {user.username} suspended'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def toggle_online(self, request):
        is_online = request.data.get('is_online', False)
        user = request.user
        user.is_online = is_online
        if is_online:
            user.last_location_update = timezone.now()
        user.save()

        # Broadcast status change to system
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'global_system',
            {
                'type': 'driver_location_update', # Use existing type to trigger marker updates
                'driver_id': user.id,
                'username': user.username,
                'lat': float(user.last_lat) if user.last_lat else 8.050,
                'lng': float(user.last_lng) if user.last_lng else 126.062,
                'status': 'Available' if is_online else 'Offline',
                'is_online': is_online
            }
        )
        
        return Response({'status': 'success', 'is_online': is_online})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def nearby_drivers(self, request):
        """
        Returns a list of drivers who are online and verified.
        """
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        
        # Priority: explicit 'is_online' field
        drivers = User.objects.filter(
            role='driver',
            is_verified_driver=True,
            is_online=True
        ).exclude(last_lat__isnull=True)

        # Fallback for demo: if no one is explicitly online, show those who updated recently
        if not drivers.exists():
            time_threshold = timezone.now() - timezone.timedelta(minutes=30)
            drivers = User.objects.filter(
                role='driver',
                is_verified_driver=True,
                last_location_update__gte=time_threshold
            ).exclude(last_lat__isnull=True)

        data = []
        for d in drivers:
            driver_info = {
                'id': d.id,
                'username': d.username,
                'lat': float(d.last_lat),
                'lng': float(d.last_lng),
                'vehicle_model': d.vehicle_model,
                'vehicle_plate': d.vehicle_plate,
                'body_number': d.body_number,
                'vehicle_color': d.vehicle_color,
                'average_rating': d.average_rating,
                'distance': None
            }
            
            if lat and lng:
                try:
                    dist = calculate_distance(
                        float(lat), float(lng),
                        float(d.last_lat), float(d.last_lng)
                    )
                    driver_info['distance'] = round(dist, 2)
                except (ValueError, TypeError):
                    pass
            
            data.append(driver_info)
        
        # Sort by distance if available
        if lat and lng:
            data.sort(key=lambda x: x['distance'] if x['distance'] is not None else 999)
            
        return Response(data[:10]) # Return top 10 nearest online drivers



class RideViewSet(viewsets.ModelViewSet):
    queryset = Ride.objects.all().order_by('-requested_at')
    serializer_class = RideSerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        payment_method = self.request.data.get('payment_method', 'cash')
        targeted_driver_id = self.request.data.get('targeted_driver_id')
        targeted_driver = None
        if targeted_driver_id:
            targeted_driver = User.objects.filter(id=targeted_driver_id, role='driver').first()
        
        ride = serializer.save(
            passenger=self.request.user,
            targeted_driver=targeted_driver
        )

        # Create Payment record
        Payment.objects.create(
            ride=ride,
            method=payment_method,
            amount=ride.fare or 0
        )
        
        channel_layer = get_channel_layer()
        
        if targeted_driver:
            # TARGETED DISPATCH: Notify the chosen driver and log status
            print(f"DEBUG: Targeted Dispatch for Ride #{ride.id} to {targeted_driver.username} (Online: {targeted_driver.is_online})")
            
            async_to_sync(channel_layer.group_send)(
                f'user_{targeted_driver.id}',
                {
                    'type': 'new_ride_request',
                    'ride': RideSerializer(ride).data
                }
            )
            
            # Broadcast to system for visibility (e.g. Admin or Global Live Map)
            async_to_sync(channel_layer.group_send)(
                'global_system',
                {
                    'type': 'system_event',
                    'event': {
                        'type': 'ride_activity',
                        'message': f"Targeted ride request for {targeted_driver.username}",
                        'ride_id': ride.id
                    }
                }
            )
            print(f"Targeted Dispatch: Notified Driver {targeted_driver.username} for Ride #{ride.id}")
        else:
            # SMART DISPATCH: Find nearest drivers
            drivers = User.objects.filter(role='driver', is_verified_driver=True).exclude(last_lat__isnull=True)
            
            nearby_drivers = []
            if ride.pickup_lat and ride.pickup_lng:
                driver_distances = []
                for driver in drivers:
                    try:
                        dist = calculate_distance(
                            float(ride.pickup_lat), float(ride.pickup_lng), 
                            float(driver.last_lat), float(driver.last_lng)
                        )
                        # Filter: Only consider drivers within their preferred search radius
                        if dist <= driver.search_radius_km: 
                            driver_distances.append((driver, dist))
                    except (ValueError, TypeError):
                        continue
                
                # Sort by distance (nearest first)
                driver_distances.sort(key=lambda x: x[1])
                nearby_drivers = [d[0] for d in driver_distances[:5]]
            
            # Fallback: Notify ALL online verified drivers if none found nearby
            recipients = nearby_drivers if nearby_drivers else User.objects.filter(role='driver', is_verified_driver=True)

            for driver in recipients:
                async_to_sync(channel_layer.group_send)(
                    f'user_{driver.id}',
                    {
                        'type': 'new_ride_request',
                        'ride': RideSerializer(ride).data
                    }
                )
            print(f"Smart Dispatch: Notified {len(recipients)} drivers for Ride #{ride.id}")

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
            elif new_status == 'completed' and old_status != 'completed':
                # CENTRALIZED COMPLETION LOGIC (ensure financial records are created)
                # Only run if not already processed
                if updated_ride.driver_earnings == 0:
                    from .models import SystemConfig, WalletTransaction, LGURevenue
                    fare = updated_ride.fare or Decimal('0.00')
                    commission_rate_config = SystemConfig.objects.filter(key='lgu_commission_rate').first()
                    rate = Decimal(commission_rate_config.value) if commission_rate_config else Decimal('5.00')
                    
                    lgu_comm = (fare * rate) / Decimal('100')
                    dr_earn = fare - lgu_comm
                    
                    updated_ride.lgu_commission = lgu_comm
                    updated_ride.driver_earnings = dr_earn
                    updated_ride.commission_rate = rate
                    updated_ride.save()
                    
                    # Credit Wallet
                    if updated_ride.driver:
                        driver = updated_ride.driver
                        driver.wallet_balance += dr_earn
                        driver.save()
                        
                        WalletTransaction.objects.create(
                            user=driver,
                            amount=dr_earn,
                            transaction_type='driver_earning',
                            reference_id=f'RIDE-{updated_ride.id}',
                            description=f'Completed Ride #{updated_ride.id}'
                        )
                        
                        # Log LGU commission
                        LGURevenue.objects.create(
                            ride=updated_ride,
                            amount=lgu_comm,
                            commission_rate=rate,
                            notes=f'Auto-recorded from Ride #{updated_ride.id}'
                        )
                
                # Mark payment as paid
                if hasattr(updated_ride, 'payment'):
                    updated_ride.payment.paid = True
                    updated_ride.payment.save()

                send_push_notification(
                    updated_ride.passenger,
                    "Ride Completed ✅",
                    f"You have arrived! Total fare: ₱{updated_ride.fare}. Thank you for riding TransMart!"
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

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def active_ride(self, request):
        if request.user.role == 'driver':
            ride = Ride.objects.filter(driver=request.user, status__in=['accepted', 'on_route']).first()
        else:
            ride = Ride.objects.filter(passenger=request.user, status__in=['requested', 'accepted', 'on_route']).first()
        
        if ride:
            return Response(RideSerializer(ride).data)
        return Response(None, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        ride = self.get_object()
        if ride.status != 'requested':
            return Response({'detail': 'Cannot reject non-pending ride'}, status=400)
            
        # If it was targeted at this driver, mark as unavailable for them
        # In this simple implementation, we'll just cancel the ride if it was targeted
        # or just notify that this driver declined.
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_status_update',
                'status': 'driver_rejected',
                'message': f"Driver {request.user.username} is currently unavailable."
            }
        )
        return Response({'status': 'rejected'})

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
    
    # Filter: Show rides targeted specifically at OR with no target at all
    from django.db.models import Q
    from django.utils import timezone
    # Strict 3-minute expiration for pending requests to ensure dashboard ONLY shows new, real-time requests.
    recent_threshold = timezone.now() - timezone.timedelta(minutes=3)
    qs = Ride.objects.filter(
        Q(status='requested') & 
        (Q(targeted_driver=request.user) | Q(targeted_driver__isnull=True)) &
        Q(requested_at__gte=recent_threshold)
    ).order_by('-requested_at')[:20]
    
    ser = RideSerializer(qs, many=True)
    return Response(ser.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def driver_reject(request, ride_id):
    if request.user.role != 'driver':
        return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
    ride = get_object_or_404(Ride, id=ride_id)
    
    # If the driver rejects a targeted request, we make it "Public" so other drivers can pick it up
    # or notify the passenger. Let's make it public but notify the passenger.
    if ride.targeted_driver == request.user:
        ride.targeted_driver = None
        ride.save()
        
        channel_layer = get_channel_layer()
        # Notify specific ride group so passenger dashboard resets
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_status_update',
                'status': 'driver_rejected',
                'message': f'Driver {request.user.username} is unavailable. Searching for other drivers...'
            }
        )
        
        # Also notify passenger personally as a backup
        async_to_sync(channel_layer.group_send)(
            f'user_{ride.passenger.id}',
            {
                'type': 'system_event',
                'event': {
                    'type': 'ride_activity',
                    'message': f"Driver {request.user.username} declined. Re-routing...",
                    'status': 'driver_rejected'
                }
            }
        )
        
    return Response({'status': 'rejected'})


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
    
    # Notify passenger via WebSocket (Reliability: Send to both Ride and User groups)
    channel_layer = get_channel_layer()
    
    # Update on specific ride channel
    async_to_sync(channel_layer.group_send)(
        f'ride_{ride.id}',
        {
            'type': 'ride_status_update',
            'status': 'accepted',
            'data': RideSerializer(ride).data
        }
    )
    
    # Update on passenger's personal channel (Master fallback)
    async_to_sync(channel_layer.group_send)(
        f'user_{ride.passenger.id}',
        {
            'type': 'system_event',
            'event': {
                'type': 'ride_matched',
                'status': 'accepted',
                'ride': RideSerializer(ride).data
            }
        }
    )
    
    return Response(RideSerializer(ride).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ride_complete(request, ride_id):
    """
    Complete a ride and calculate LGU commission (5% default).
    Automatically deducts commission and credits driver earnings to wallet.
    """
    from .models import LGURevenue
    
    if request.user.role != 'driver':
        return Response({'detail': 'Only drivers can complete rides'}, status=status.HTTP_403_FORBIDDEN)
    
    ride = get_object_or_404(Ride, id=ride_id)
    
    # Verify driver owns this ride
    if ride.driver != request.user:
        return Response({'detail': 'You are not the driver for this ride'}, status=status.HTTP_403_FORBIDDEN)
    
    # Verify ride is in acceptable status
    if ride.status not in ['accepted', 'on_route']:
        return Response({'detail': f'Cannot complete ride with status: {ride.status}'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get commission rate from SystemConfig or use default 5%
    commission_rate_config = SystemConfig.objects.filter(key='lgu_commission_rate').first()
    commission_rate = Decimal(commission_rate_config.value) if commission_rate_config else Decimal('5.00')
    
    # Calculate commission and driver earnings
    total_fare = ride.fare or Decimal('0.00')
    lgu_commission = (total_fare * commission_rate) / Decimal('100')
    driver_earnings = total_fare - lgu_commission
    
    # Update ride
    ride.status = 'completed'
    ride.completed_at = timezone.now()
    ride.lgu_commission = lgu_commission
    ride.driver_earnings = driver_earnings
    ride.commission_rate = commission_rate
    ride.save()

    # Mark payment as paid
    if hasattr(ride, 'payment'):
        ride.payment.paid = True
        ride.payment.save()
    
    # Credit driver wallet with net earnings (after commission)
    driver = ride.driver
    driver.wallet_balance += driver_earnings
    driver.save()
    
    # Log driver earning transaction
    WalletTransaction.objects.create(
        user=driver,
        amount=driver_earnings,
        transaction_type='driver_earning',
        reference_id=f'RIDE-{ride.id}',
        description=f'Ride #{ride.id} earnings (₱{total_fare} - ₱{lgu_commission} LGU commission)'
    )
    
    # Log LGU commission revenue
    LGURevenue.objects.create(
        ride=ride,
        amount=lgu_commission,
        commission_rate=commission_rate,
        purpose='general',  # Can be customized based on admin settings
        notes=f'Commission from Ride #{ride.id} - {driver.username}'
    )
    
    # Notify passenger via WebSocket
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'ride_{ride.id}',
        {
            'type': 'ride_status_update',
            'status': 'completed',
            'data': RideSerializer(ride).data
        }
    )
    
    # Broadcast to admin activity feed
    async_to_sync(channel_layer.group_send)(
        'global_system',
        {
            'type': 'system_event',
            'event': {
                'type': 'ride_completed',
                'message': f'Ride #{ride.id} completed - ₱{lgu_commission} LGU revenue collected',
                'ride_id': ride.id,
                'timestamp': timezone.now().isoformat()
            }
        }
    )
    
    # Notify passenger
    send_push_notification(
        ride.passenger,
        "Ride Completed ✅",
        f"You have arrived! Total fare: ₱{total_fare}. Thank you for riding with us!"
    )
    
    # Notify driver
    send_push_notification(
        driver,
        "Ride Completed 💰",
        f"Earned ₱{driver_earnings} (₱{total_fare} - ₱{lgu_commission} LGU commission). New balance: ₱{driver.wallet_balance}"
    )
    
    return Response({
        'status': 'completed',
        'total_fare': str(total_fare),
        'lgu_commission': str(lgu_commission),
        'driver_earnings': str(driver_earnings),
        'commission_rate': str(commission_rate),
        'driver_balance': str(driver.wallet_balance),
        'message': f'Ride completed successfully. ₱{driver_earnings} credited to your wallet.'
    })



@api_view(['GET'])
@permission_classes([AllowAny])
def track_ride(request, token):
    try:
        ride = Ride.objects.get(share_token=token)
    except (Ride.DoesNotExist, ValueError):
        return Response({'detail': 'Invalid tracking link'}, status=status.HTTP_404_NOT_FOUND)
        
    driver_data = None
    if ride.driver:
        driver_data = {
            'username': ride.driver.username,
            'vehicle_model': ride.driver.vehicle_model,
            'vehicle_plate': ride.driver.vehicle_plate,
            'vehicle_color': ride.driver.vehicle_color,
            'lat': ride.driver.last_lat,
            'lng': ride.driver.last_lng,
            'rating': ride.driver.average_rating
        }

    return Response({
        'status': ride.status,
        'passenger': ride.passenger.first_name or ride.passenger.username,
        'pickup': ride.pickup_address,
        'destination': ride.dest_address,
        'started_at': ride.started_at,
        'driver': driver_data
    })


class DriverVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        try:
            if request.user.role != 'driver':
                return Response({'detail': 'Only drivers can submit verification documents.'}, status=status.HTTP_403_FORBIDDEN)
            
            print(f"Driver Verification Request from: {request.user.username}")
            print(f"Request Data: {request.data}")
            print(f"Request Files: {request.FILES}")
            
            # Merge files explicitly — guarantees uploads are processed
            # regardless of how the multipart boundary is parsed
            merged_data = request.data.copy()
            for field_name, file_obj in request.FILES.items():
                merged_data[field_name] = file_obj

            serializer = DriverVerificationSerializer(request.user, data=merged_data, partial=True)
            if serializer.is_valid():
                try:
                    user = serializer.save()
                    # If they update documents, they need to be re-verified
                    user.is_verified_driver = False
                    user.verification_status = 'pending'
                    user.save()
                    
                    print(f"Verification documents saved for {user.username}")
                    
                    # Try to send notification, but don't fail if it doesn't work
                    try:
                        send_push_notification(
                            request.user,
                            "Verification Submitted 📄",
                            "Your documents have been received. Please wait for admin re-approval."
                        )
                    except Exception as notif_err:
                        print(f"Notification failed (non-critical): {notif_err}")
                    
                    return Response({
                        'detail': 'Documents submitted successfully. Waiting for admin approval.',
                        'status': 'success'
                    })
                except Exception as save_err:
                    print(f"Error saving verification data: {save_err}")
                    import traceback
                    traceback.print_exc()
                    return Response({
                        'detail': f'Failed to save documents: {str(save_err)}',
                        'errors': {'save_error': str(save_err)}
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            print(f"Validation Errors: {serializer.errors}")
            return Response({
                'detail': 'Validation failed. Please check your inputs.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            print(f"Unexpected error in DriverVerificationView: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'detail': f'Server error: {str(e)}',
                'errors': {'server_error': str(e)}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DriverAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'driver':
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        # Calculate earnings
        today = timezone.now().date()
        week_start = today - timezone.timedelta(days=today.weekday())
        
        rides = Ride.objects.filter(driver=request.user, status='completed')
        
        today_earnings = sum(r.driver_earnings for r in rides.filter(completed_at__date=today)) if rides.exists() else 0
        week_earnings = sum(r.driver_earnings for r in rides.filter(completed_at__date__gte=week_start)) if rides.exists() else 0
        total_earnings = sum(r.driver_earnings for r in rides) if rides.exists() else 0
        
        # Last 7 days chart data
        chart_data = []
        for i in range(6, -1, -1):
            date = today - timezone.timedelta(days=i)
            day_earnings = sum(r.driver_earnings for r in rides.filter(completed_at__date=date))
            chart_data.append({
                'day': date.strftime('%a'),
                'amount': float(day_earnings)
            })
            
        return Response({
            'today': float(today_earnings),
            'week': float(week_earnings),
            'total': float(total_earnings),
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
            amt = Decimal(str(amount))
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


# ─────────────────────────────────────────────────────────────────────────────
# REAL-TIME LOCATION ENDPOINTS  (Universal — works for all roles)
# ─────────────────────────────────────────────────────────────────────────────

class LocationUpdateView(APIView):
    """
    POST /api/location/update/

    Save the authenticated user's current GPS coordinates.
    Works for drivers, passengers, and admins alike.

    Request body:
        { "lat": 8.2965, "lng": 126.0630 }

    Response:
        { "status": "ok", "lat": 8.2965, "lng": 126.063, "role": "driver" }

    Side-effects:
        - Persists last_lat / last_lng / last_location_update on the User model
        - For drivers: also broadcasts location via WebSocket to the global
          system channel (updates the admin live map and nearby passenger views)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lat = request.data.get('lat')
        lng = request.data.get('lng')

        if lat is None or lng is None:
            return Response(
                {'detail': 'Both "lat" and "lng" are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(lat)
            lng = float(lng)
        except (ValueError, TypeError):
            return Response(
                {'detail': '"lat" and "lng" must be valid numbers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist to user model (same fields used by the existing driver tracker)
        user = request.user
        user.last_lat = lat
        user.last_lng = lng
        user.last_location_update = timezone.now()
        user.save(update_fields=['last_lat', 'last_lng', 'last_location_update'])

        # For drivers: push real-time update to WebSocket channel so the
        # admin live map and passenger tracking panels refresh immediately.
        if user.role == 'driver':
            try:
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    'global_system',
                    {
                        'type': 'driver_location_update',
                        'driver_id': user.id,
                        'username': user.username,
                        'lat': lat,
                        'lng': lng,
                        'status': 'Available' if user.is_online else 'Offline',
                    }
                )
            except Exception as ws_err:
                # Non-critical – log only
                print(f"[location/update] WebSocket broadcast failed: {ws_err}")

        return Response({
            'status': 'ok',
            'lat': lat,
            'lng': lng,
            'role': user.role,
            'updated_at': user.last_location_update.isoformat(),
        })


class NearbyLocationsView(APIView):
    """
    GET /api/location/nearby/

    Return recently-active users with known coordinates.

    Query params (all optional):
        role   – filter by role: 'driver' | 'passenger' | 'all'  (default: 'driver')
        lat    – requester's latitude  (used to compute distance)
        lng    – requester's longitude
        radius – max distance in km    (default: 10)

    Response:
        [
          {
            "id":        1,
            "username":  "juan",
            "role":      "driver",
            "lat":       8.2965,
            "lng":       126.063,
            "distance":  0.42,          // km — only if lat/lng provided
            "is_online": true,
            "updated_at": "2026-04-13T…"
          },
          …
        ]
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role_filter    = request.query_params.get('role', 'driver')
        radius_km      = float(request.query_params.get('radius', 10))
        requester_lat  = request.query_params.get('lat')
        requester_lng  = request.query_params.get('lng')

        # Only show users that updated their location in the last 30 minutes
        time_threshold = timezone.now() - timezone.timedelta(minutes=30)

        qs = User.objects.filter(
            last_location_update__gte=time_threshold
        ).exclude(last_lat__isnull=True).exclude(last_lng__isnull=True)

        if role_filter and role_filter != 'all':
            qs = qs.filter(role=role_filter)

        results = []
        for u in qs:
            entry = {
                'id':         u.id,
                'username':   u.username,
                'role':       u.role,
                'lat':        float(u.last_lat),
                'lng':        float(u.last_lng),
                'is_online':  u.is_online,
                'updated_at': u.last_location_update.isoformat() if u.last_location_update else None,
                'distance':   None,
            }

            # Compute distance if requester coordinates were provided
            if requester_lat and requester_lng:
                try:
                    dist = calculate_distance(
                        float(requester_lat), float(requester_lng),
                        float(u.last_lat), float(u.last_lng)
                    )
                    entry['distance'] = round(dist, 3)
                    if dist > radius_km:
                        continue  # Skip users outside requested radius
                except (ValueError, TypeError):
                    pass

            results.append(entry)

        # Sort nearest first when distance is available
        if requester_lat and requester_lng:
            results.sort(key=lambda x: x['distance'] if x['distance'] is not None else 9999)

        return Response(results[:50])  # Cap at 50 results

