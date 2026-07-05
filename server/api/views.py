from django.db import models
import math
from rest_framework import viewsets, status, parsers, serializers
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')
from .models import Ride, WalletTransaction, Withdrawal, Review, Incident, Complaint, SystemConfig, SavedPlace, Broadcast, MaintenanceLog, Payment, ActivityLog, ScheduledRide
from .serializers import (
    UserSerializer, RegisterSerializer, RideSerializer, 
    DriverVerificationSerializer, WalletTransactionSerializer, WithdrawalSerializer,
    ReviewSerializer, IncidentSerializer, ComplaintSerializer, CustomTokenObtainPairSerializer,
    SavedPlaceSerializer, SystemConfigSerializer, BroadcastSerializer, MaintenanceLogSerializer,
    ActivityLogSerializer, ScheduledRideSerializer
)
from decimal import Decimal
from .notifications import send_sms, send_push_notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.utils import timezone
from .fraud_service import FraudDetectionService
from django.contrib.auth.hashers import make_password, check_password
from .models import TransactionPIN


import os
import requests
from django.conf import settings

def log_activity(user, action, details, request=None):
    ip_address = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')
    try:
        ActivityLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            details=details,
            ip_address=ip_address
        )
    except Exception as e:
        print(f"Failed to log activity: {e}")


def send_brevo_email(recipient_email, recipient_name, subject, html_content):
    """
    Sends an email using the Brevo HTTP API (primary) or Django SMTP (fallback).

    Strategy:
      1. If BREVO_API_KEY is set → use Brevo's transactional email HTTP API
         (works on Railway/cloud where outbound SMTP ports 465/587 are blocked).
      2. Else if EMAIL_HOST_USER is set → fall back to Django native SMTP
         (works locally and on servers that allow outbound SMTP).
      3. If neither is configured → return error immediately.
    """
    import requests as http_requests
    import os

    brevo_key = os.environ.get('BREVO_API_KEY', '').strip()
    smtp_user = getattr(settings, 'EMAIL_HOST_USER', '').strip()

    # ── Strategy 1: Brevo HTTP API (cloud-friendly, no SMTP port needed) ─────
    if brevo_key:
        try:
            resp = http_requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={
                    'api-key': brevo_key,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                json={
                    'sender': {
                        'name': 'Trento Smart System',
                        'email': smtp_user if smtp_user else 'noreply@transmart.com',
                    },
                    'to': [{'email': recipient_email, 'name': recipient_name}],
                    'subject': subject,
                    'htmlContent': html_content,
                },
                timeout=15,
            )
            if resp.status_code in (200, 201):
                print(f"[Email] Success: Brevo API sent email to {recipient_email}")
                return True, "Email sent successfully via Brevo API"
            else:
                err = resp.text
                print(f"[Email] Warning: Brevo API returned {resp.status_code} for {recipient_email}: {err}")
                # Fall through to SMTP fallback
        except Exception as e:
            print(f"[Email] Warning: Brevo API exception for {recipient_email}: {e}")
            # Fall through to SMTP fallback

    # ── Strategy 2: Django SMTP fallback (local dev / servers with open ports) ─
    if smtp_user:
        from django.core.mail import EmailMultiAlternatives
        from django.utils.html import strip_tags

        try:
            text_content = strip_tags(html_content)
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@transmart.com')
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=f"Trento Smart System <{from_email}>",
                to=[recipient_email],
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            print(f"[Email] Success: SMTP sent email to {recipient_email}")
            return True, "Email sent successfully via Gmail SMTP"
        except Exception as e:
            print(f"[Email] Error: SMTP Email FAILED for {recipient_email}: {e}")
            return False, str(e)

    # ── Neither method configured ─────────────────────────────────────────────
    err_msg = "No email provider configured. Set BREVO_API_KEY or EMAIL_HOST_USER in your environment."
    print(f"[Email] Error: {err_msg}")
    return False, err_msg


# ── PIN Lockout Helper ────────────────────────────────────────────────────────
# MAX_PIN_ATTEMPTS: number of wrong tries before lockout
# LOCKOUT_MINUTES : how long the account stays locked
MAX_PIN_ATTEMPTS = 5
LOCKOUT_MINUTES  = 15

def verify_pin_with_lockout(pin_obj, pin_code):
    """
    Verifies a TransactionPIN against the provided plain-text pin_code.
    Enforces lockout after MAX_PIN_ATTEMPTS consecutive failures.

    Returns (ok: bool, error_message: str | None)
    - ok=True  → PIN correct, failed_attempts reset to 0
    - ok=False → wrong PIN or account locked, error_message explains why
    """
    now = timezone.now()

    # 1. Check if currently locked
    if pin_obj.is_locked:
        if pin_obj.locked_until and now < pin_obj.locked_until:
            remaining = int((pin_obj.locked_until - now).total_seconds() // 60) + 1
            return False, (
                f'PIN is locked due to too many failed attempts. '
                f'Please try again in {remaining} minute(s).'
            )
        else:
            # Lockout period has expired — auto-unlock
            pin_obj.is_locked      = False
            pin_obj.locked_until   = None
            pin_obj.failed_attempts = 0
            pin_obj.save(update_fields=['is_locked', 'locked_until', 'failed_attempts'])

    # 2. Verify the PIN
    if not check_password(pin_code, pin_obj.pin_hash):
        pin_obj.failed_attempts += 1

        if pin_obj.failed_attempts >= MAX_PIN_ATTEMPTS:
            pin_obj.is_locked    = True
            pin_obj.locked_until = now + timezone.timedelta(minutes=LOCKOUT_MINUTES)
            pin_obj.save(update_fields=['failed_attempts', 'is_locked', 'locked_until'])
            return False, (
                f'Too many incorrect attempts. '
                f'Your PIN has been locked for {LOCKOUT_MINUTES} minutes.'
            )

        attempts_left = MAX_PIN_ATTEMPTS - pin_obj.failed_attempts
        pin_obj.save(update_fields=['failed_attempts'])
        return False, f'Incorrect PIN. {attempts_left} attempt(s) remaining.'

    # 3. Correct PIN — reset counter
    if pin_obj.failed_attempts > 0:
        pin_obj.failed_attempts = 0
        pin_obj.save(update_fields=['failed_attempts'])

    return True, None

def check_admin_pin(request):
    if request.user.role != 'admin':
        return False, "Forbidden - Admin access required."
    
    # Try header first, then body
    pin_code = request.headers.get('X-Admin-PIN') or request.data.get('pin')
    if not pin_code:
        return False, "Security PIN is required for this action."
    
    try:
        from .models import TransactionPIN
        pin_obj = TransactionPIN.objects.get(user=request.user)
        return verify_pin_with_lockout(pin_obj, pin_code)
    except Exception:
        return False, "Please set up your 6-digit Security PIN in your Profile first."


import random
import string

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
    throttle_classes    = (ScopedRateThrottle,)
    throttle_scope      = 'register'

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        
        # Generate 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))
        
        user = ser.save()
        user.email_otp = otp
        user.save(update_fields=['email_otp'])
        print(f"👉 [DEMO/LOG] Generated initial OTP for {user.email}: {otp}")

        # ── Fire all post-registration notifications in the background ────────
        # This ensures the API returns immediately (< 200ms) without waiting
        # for SMTP connections which can take 5-10 seconds each.
        import threading
        from django.core.mail import send_mail
        from django.conf import settings as django_settings

        def send_notifications(username, email, role, date_joined, otp_code):
            # Welcome Email with OTP
            try:
                html_msg = f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2>Verify Your Trento Smart Account 🛺</h2>
                    <p>Hi {username},</p>
                    <p>Welcome to the Trento Smart Tricycle System!</p>
                    <p>To complete your registration, please verify your email address using the code below.</p>
                    <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 12px; margin: 20px 0;">
                        <h1 style="font-size: 36px; letter-spacing: 8px; color: #2563eb; margin: 0;">{otp_code}</h1>
                    </div>
                    <p>This code expires in 30 minutes. Do not share it with anyone.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                        <p style="margin:0 0 10px 0;"><b>Account Details:</b></p>
                        <ul style="margin:0; padding-left: 20px;">
                            <li>Username: {username}</li>
                            <li>Email: {email}</li>
                            <li>Role: {role.capitalize()}</li>
                        </ul>
                    </div>
                    <p>{"Your driver account is currently pending verification. The admin will review your documents and approve your account shortly." if role == 'driver' else "Once verified, you can log in and start booking rides!"}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="color: #64748b; font-size: 12px; text-align: center;">If you did not create this account, please ignore this email or contact support immediately.</p>
                </div>
                """
                success, response = send_brevo_email(email, username, 'Verify Your Trento Smart Account 🛺', html_msg)
                if success:
                    print(f"[Email] ✅ Verification OTP sent to {email}")
                else:
                    print(f"[Email] ❌ Welcome email FAILED for {email}: {response}")
            except Exception as e:
                print(f"[Email] ❌ Welcome email Exception: {e}")

            # Admin Notification Email
            try:
                admin_email = getattr(django_settings, 'ADMIN_NOTIFICATION_EMAIL', getattr(django_settings, 'DEFAULT_FROM_EMAIL', None))
                if admin_email and admin_email != email:  # Don't double-email if same address
                    html_msg = f"""
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2>🆕 New {role.capitalize()} Registered — {username}</h2>
                        <p>A new user has registered on the Trento Smart System.</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                            <p style="margin:0 0 10px 0;"><b>User Details:</b></p>
                            <ul style="margin:0; padding-left: 20px;">
                                <li>Username: {username}</li>
                                <li>Email: {email}</li>
                                <li>Role: {role.capitalize()}</li>
                                <li>Joined At: {date_joined.strftime('%B %d, %Y at %I:%M %p') if date_joined else 'N/A'}</li>
                            </ul>
                        </div>
                        <p style="color: #ef4444; font-weight: bold;">{"⚠️ This driver account requires your verification approval." if role == 'driver' else ""}</p>
                        <p>Log in to the Admin Dashboard to manage this user:</p>
                        <a href="https://trentosmartsystem-production.up.railway.app/admin/" style="display: inline-block; background-color: #0f172a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Open Admin Dashboard</a>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="color: #64748b; font-size: 12px; text-align: center;">Trento Smart Automated System</p>
                    </div>
                    """
                    success, response = send_brevo_email(admin_email, "Admin", f'🆕 New {role.capitalize()} Registered — {username}', html_msg)
                    if success:
                        print(f"[Email] ✅ Admin notification sent to {admin_email}")
                    else:
                        print(f"[Email] ❌ Admin notification FAILED: {response}")
            except Exception as e:
                print(f"[Email] ❌ Admin notification Exception: {e}")

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
            args=(user.username, user.email, user.role, user.date_joined, otp),
            daemon=True
        )
        thread.start()

        return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)




class CheckEmailView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'check_field'

    def get(self, request):
        email = request.query_params.get('email', '')
        if not email:
            return Response({'error': 'Email is required'}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        return Response({'available': not exists})

class CheckUsernameView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'check_field'

    def get(self, request):
        username = request.query_params.get('username', '')
        if not username:
            return Response({'error': 'Username is required'}, status=400)
        exists = User.objects.filter(username__iexact=username).exists()
        return Response({'available': not exists})

class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class   = CustomTokenObtainPairSerializer
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'login'
    

class GoogleLoginView(APIView):
    """
    Handles Google Sign-In via Firebase.
    
    Flow:
    1. Frontend signs in with Google via Firebase Auth (popup)
    2. Frontend sends the Firebase ID token to this endpoint
    3. Backend verifies the token using Firebase Admin SDK
    4. Backend finds or creates a Django user for this Google account
    5. Backend returns JWT access/refresh tokens (same as normal login)
    """
    permission_classes = (AllowAny,)
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'login'

    def post(self, request):
        id_token = request.data.get('token')
        if not id_token:
            return Response(
                {'detail': 'Firebase ID token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Verify the Firebase ID token
        try:
            from .firebase_utils import verify_google_token
            decoded = verify_google_token(id_token)
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Extract Google profile info
        google_email = decoded.get('email', '').lower()
        google_name  = decoded.get('name', '')
        google_photo = decoded.get('picture', '')
        firebase_uid = decoded.get('uid', '')

        if not google_email:
            return Response(
                {'detail': 'Google account does not have an email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Find or create the Django user
        try:
            user = User.objects.filter(email__iexact=google_email).first()
            
            if user:
                # Existing user — ensure email is verified (they proved ownership via Google)
                if not user.is_email_verified:
                    user.is_email_verified = True
                    user.save(update_fields=['is_email_verified'])
                    print(f"[Google Auth] ✅ Auto-verified email for existing user: {user.username}")
            else:
                # New user — create account automatically
                # Generate a unique username from the email prefix
                base_username = google_email.split('@')[0]
                username = base_username
                counter = 1
                while User.objects.filter(username__iexact=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                # Create user with unusable password (Google-only auth)
                user = User(
                    username=username,
                    email=google_email,
                    role='passenger',  # Default role for Google sign-ups
                    is_email_verified=True,  # Email is verified via Google
                )
                user.set_unusable_password()
                user.save()

                print(f"[Google Auth] 🆕 Created new user via Google: {username} ({google_email})")

                # Send admin notification in background (non-blocking)
                import threading
                from django.conf import settings as django_settings

                def _notify_admin_google_signup(uname, uemail):
                    try:
                        admin_email = getattr(django_settings, 'ADMIN_NOTIFICATION_EMAIL', getattr(django_settings, 'DEFAULT_FROM_EMAIL', None))
                        if admin_email:
                            html_msg = f"""
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                <h2>🆕 New Google Sign-Up — {uname}</h2>
                                <p>A new passenger registered via Google Sign-In.</p>
                                <ul>
                                    <li>Username: {uname}</li>
                                    <li>Email: {uemail}</li>
                                    <li>Method: Google OAuth</li>
                                </ul>
                            </div>
                            """
                            send_brevo_email(admin_email, "Admin", f'🆕 New Google Sign-Up — {uname}', html_msg)
                    except Exception as e:
                        print(f"[Google Auth] Admin notification failed (non-critical): {e}")

                threading.Thread(target=_notify_admin_google_signup, args=(username, google_email), daemon=True).start()

        except Exception as e:
            import traceback
            print(f"[Google Auth] CRITICAL ERROR finding/creating user:\n{traceback.format_exc()}")
            return Response(
                {'detail': f'Error creating user account: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 4. Generate JWT tokens (same format as normal login)
        try:
            refresh = RefreshToken.for_user(user)
        except Exception as e:
            return Response(
                {'detail': f'Error generating token: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Add custom claims to match CustomTokenObtainPairSerializer
        refresh['role'] = user.role
        refresh['username'] = user.username
        refresh['email'] = user.email
        refresh['is_verified_driver'] = user.is_verified_driver
        refresh['verification_status'] = user.verification_status
        if user.profile_picture:
            refresh['profile_picture'] = user.profile_picture.url
        else:
            refresh['profile_picture'] = None

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_200_OK)


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


class ChangePasswordView(APIView):
    """Allows authenticated users to change their password by providing the current one."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not current_password or not new_password:
            return Response({'detail': 'Current password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(current_password):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'detail': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'detail': 'New password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        if current_password == new_password:
            return Response({'detail': 'New password must be different from the current one.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        print(f"[Security] ✅ Password changed for {request.user.username}")
        return Response({'detail': 'Password changed successfully! Please log in again with your new password.'}, status=status.HTTP_200_OK)


class ChangeEmailView(APIView):
    """Allows authenticated users to change their email. Sends OTP to new email for verification."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import random, string

        new_email = request.data.get('new_email', '').strip().lower()
        password = request.data.get('password', '')

        if not new_email or not password:
            return Response({'detail': 'New email and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(password):
            return Response({'detail': 'Password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_email == request.user.email:
            return Response({'detail': 'This is already your current email.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if email is already taken by another user
        if User.objects.filter(email__iexact=new_email).exclude(id=request.user.id).exists():
            return Response({'detail': 'This email is already in use by another account.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate OTP and save to user
        otp = ''.join(random.choices(string.digits, k=6))
        request.user.email_otp = otp
        request.user.save(update_fields=['email_otp'])
        print(f"👉 [DEMO/LOG] Email change OTP for {request.user.username} -> {new_email}: {otp}")

        # Send OTP to the NEW email
        import threading
        def _send_change_email_otp(username, target_email, otp_code):
            html_msg = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2>Confirm Your New Email Address 🛺</h2>
                <p>Hi {username},</p>
                <p>You requested to change your Trento Smart email to <b>{target_email}</b>.</p>
                <p>Enter this code in the app to confirm:</p>
                <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 12px; margin: 20px 0;">
                    <h1 style="font-size: 36px; letter-spacing: 8px; color: #2563eb; margin: 0;">{otp_code}</h1>
                </div>
                <p>This code expires in 30 minutes. If you didn't request this, ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="color: #64748b; font-size: 12px; text-align: center;">Trento Smart System</p>
            </div>
            """
            success, response = send_brevo_email(target_email, username, 'Confirm Your New Email — Trento Smart 🛺', html_msg)
            if success:
                print(f"[Email] ✅ Email change OTP sent to {target_email}")
            else:
                print(f"[Email] ❌ Email change OTP FAILED: {response}")

        thread = threading.Thread(target=_send_change_email_otp, args=(request.user.username, new_email, otp), daemon=True)
        thread.start()

        return Response({'detail': f'A verification code has been sent to {new_email}.'}, status=status.HTTP_200_OK)


class ConfirmEmailChangeView(APIView):
    """Confirms the email change by verifying the OTP sent to the new email."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_email = request.data.get('new_email', '').strip().lower()
        otp = request.data.get('otp', '').strip()

        if not new_email or not otp:
            return Response({'detail': 'New email and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.email_otp and request.user.email_otp == otp:
            old_email = request.user.email
            request.user.email = new_email
            request.user.email_otp = None
            request.user.save(update_fields=['email', 'email_otp'])
            print(f"[Security] ✅ Email changed for {request.user.username}: {old_email} -> {new_email}")
            return Response({'detail': 'Email updated successfully!'}, status=status.HTTP_200_OK)
        else:
            return Response({'detail': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True).order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Always build a fresh queryset from the DB to avoid stale cache issues.
        # Using self.queryset directly can return a cached, stale result which
        # causes "No User matches the given query" errors on delete/update.
        if self.request.user.role == 'admin':
            return User.objects.filter(is_active=True).order_by('-date_joined')
        # Users can only see themselves (though usually handled by ProfileView)
        return User.objects.filter(id=self.request.user.id, is_active=True).order_by('-date_joined')

    def perform_destroy(self, instance):
        # Soft-delete: deactivate user account to preserve historical transactions, rides and audits
        instance.is_active = False
        instance.save(update_fields=['is_active'])


    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            print(f"Delete request from {request.user.username} (Role: {request.user.role}) for user {instance.username}")

            if request.user.role == 'admin':
                ok, err = check_admin_pin(request)
                if not ok:
                    return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

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
            
        except Http404:
            raise
        except Exception as e:
            print(f"Error deleting user: {e}")
            import traceback
            tb = traceback.format_exc()
            traceback.print_exc()
            return Response({
                'detail': f'Failed to delete user: {str(e)}',
                'traceback': tb,
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
            log_activity(request.user, "Driver Approved", f"Approved driver: {user.username} (ID: {user.id})", request)
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
            ok, err = check_admin_pin(request)
            if not ok: return Response({'detail': err}, status=status.HTTP_403_FORBIDDEN)
            
            user = self.get_object()
            if user.role != 'driver': return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_verified_driver = False
            user.verification_status = 'rejected'
            user.save()
            log_activity(request.user, "Driver Rejected", f"Rejected driver: {user.username} (ID: {user.id})", request)
            return Response({'status': 'rejected', 'detail': f'Driver {user.username} rejected'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def suspend_driver(self, request, pk=None):
        try:
            ok, err = check_admin_pin(request)
            if not ok: return Response({'detail': err}, status=status.HTTP_403_FORBIDDEN)

            user = self.get_object()
            if user.role != 'driver': return Response({'detail': 'User is not a driver'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_verified_driver = False
            user.verification_status = 'suspended'
            user.save()
            log_activity(request.user, "Driver Suspended", f"Suspended driver: {user.username} (ID: {user.id})", request)
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
    serializer_class = RideSerializer

    def get_queryset(self):
        user = self.request.user
        base_qs = Ride.objects.select_related('passenger', 'driver', 'targeted_driver').order_by('-requested_at')
        if user.role == 'admin':
            return base_qs
        from django.db import models
        return base_qs.filter(models.Q(passenger=user) | models.Q(driver=user))

    def get_permissions(self):
        if self.action in ['create']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        payment_method = self.request.data.get('payment_method', 'cash')
        targeted_driver_id = self.request.data.get('targeted_driver_id')
        targeted_driver = None
        if targeted_driver_id:
            try:
                # Safely parse targeted_driver_id to int to handle non-numeric strings ('null', 'undefined', etc.)
                driver_id_int = int(targeted_driver_id)
                targeted_driver = User.objects.filter(id=driver_id_int, role='driver').first()
            except (ValueError, TypeError):
                targeted_driver = None
        
        # Enforce passenger capacity
        passenger_count = self.request.data.get('passenger_count', 1)
        try:
            passenger_count = int(passenger_count)
        except (ValueError, TypeError):
            passenger_count = 1

        max_capacity_cfg = SystemConfig.objects.filter(key='max_capacity').first()
        max_capacity = 5
        if max_capacity_cfg:
            try:
                max_capacity = int(max_capacity_cfg.value)
            except ValueError:
                pass

        if passenger_count > max_capacity:
            raise serializers.ValidationError({"detail": f"Passenger count cannot exceed the tricycle capacity of {max_capacity} passengers."})
        if passenger_count < 1:
            raise serializers.ValidationError({"detail": "Passenger count must be at least 1."})

        nearest_landmark = self.request.data.get('nearest_landmark', '')
        notes = self.request.data.get('notes', '')

        from django.db import DatabaseError
        try:
            ride = serializer.save(
                passenger=self.request.user,
                targeted_driver=targeted_driver,
                passenger_count=passenger_count,
                nearest_landmark=nearest_landmark,
                notes=notes
            )
            # Create Payment record
            Payment.objects.create(
                ride=ride,
                method=payment_method,
                amount=ride.fare or 0
            )
        except DatabaseError as db_err:
            # Most likely cause: unapplied migration (missing column in DB).
            # Run `python manage.py migrate` on the server to fix this.
            error_msg = str(db_err)
            print(f"[RideViewSet] DB DatabaseError during ride creation: {error_msg}")
            raise serializers.ValidationError({
                "detail": "Ride creation failed due to a database or server configuration issue. Please ensure all database migrations are applied.",
                "server_error": error_msg
            })

        log_activity(self.request.user, "Ride Requested", f"Passenger {self.request.user.username} requested Ride #{ride.id} for {passenger_count} passenger(s) to {ride.dest_address} (Fare: ₱{ride.fare})", self.request)

        
        channel_layer = get_channel_layer()
        
        try:
            if targeted_driver:
                # TARGETED DISPATCH: Notify the chosen driver and log status
                print(f"DEBUG: Targeted Dispatch for Ride #{ride.id} to {targeted_driver.username} (Online: {targeted_driver.is_online})")
                
                if channel_layer:
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
                # SMART DISPATCH: Only consider online, verified drivers
                drivers = User.objects.filter(
                    role='driver',
                    is_verified_driver=True,
                    is_online=True,
                ).exclude(last_lat__isnull=True)

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

                # Fallback: Notify ALL currently online verified drivers (never include offline)
                if nearby_drivers:
                    recipients = nearby_drivers
                else:
                    recipients = list(User.objects.filter(
                        role='driver',
                        is_verified_driver=True,
                        is_online=True,
                    ))

                if channel_layer:
                    for driver in recipients:
                        async_to_sync(channel_layer.group_send)(
                            f'user_{driver.id}',
                            {
                                'type': 'new_ride_request',
                                'ride': RideSerializer(ride).data
                            }
                        )
                print(f"Smart Dispatch: Notified {len(recipients)} online drivers for Ride #{ride.id}")
        except Exception as dispatch_err:
            print(f"WebSocket dispatch failed but ride was created successfully: {dispatch_err}")

    def perform_update(self, serializer):
        # Fetch original instance to compare status
        instance = self.get_object()
        old_status = instance.status
        
        updated_ride = serializer.save()
        new_status = updated_ride.status
        
        if old_status != new_status:
            log_activity(self.request.user, "Ride Status Updated", f"Ride #{updated_ride.id} status changed from {old_status} to {new_status} by {self.request.user.username}", self.request)
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
            elif new_status == 'cancelled' and old_status != 'cancelled':
                if updated_ride.driver and self.request.user == updated_ride.passenger:
                    from .models import WalletTransaction, FraudAlert
                    from decimal import Decimal
                    
                    # Log cancellation
                    updated_ride.cancelled_by = self.request.user
                    updated_ride.cancellation_reason = self.request.data.get('cancellation_reason', 'Cancelled by passenger after driver accepted')
                    updated_ride.save(update_fields=['cancelled_by', 'cancellation_reason'])
                    
                    # Check recent cancellations
                    one_day_ago = timezone.now() - timezone.timedelta(hours=24)
                    recent_cancels = Ride.objects.filter(
                        passenger=self.request.user,
                        status='cancelled',
                        cancelled_by=self.request.user,
                        driver__isnull=False,
                        requested_at__gte=one_day_ago
                    ).count()
                    
                    if recent_cancels >= 3:
                        fee = Decimal('10.00')
                        if self.request.user.wallet_balance >= fee:
                            self.request.user.wallet_balance -= fee
                            self.request.user.save()
                            WalletTransaction.objects.create(
                                user=self.request.user,
                                amount=fee,
                                transaction_type='payment',
                                description='Cancellation Penalty Fee'
                            )
                            send_push_notification(self.request.user, "Cancellation Penalty", "You have been charged ₱10.00 for excessive ride cancellations.")
                        else:
                            FraudAlert.objects.create(
                                user=self.request.user,
                                reason="Excessive Cancellations",
                                details=f"Passenger cancelled {recent_cancels} rides after driver acceptance in 24h.",
                                severity='medium'
                            )
                            send_push_notification(self.request.user, "Warning: Excessive Cancellations", "You have cancelled multiple rides after a driver accepted. This hurts our drivers. Further cancellations may result in account suspension.")

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
        import math
        # AI Fare Elasticity Logic powered by SystemConfig
        base_fare_cfg = SystemConfig.objects.filter(key='base_fare').first()
        base_fare = float(base_fare_cfg.value) if base_fare_cfg else 30.00
        
        per_km_cfg = SystemConfig.objects.filter(key='rate_per_km').first()
        rate_per_km = float(per_km_cfg.value) if per_km_cfg else 8.00
        
        base_distance = 2.0
        base_distance_cfg = SystemConfig.objects.filter(key='base_distance').first()
        if base_distance_cfg:
            try:
                base_distance = float(base_distance_cfg.value)
            except ValueError:
                pass

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

        # Calculate exact fare if distance is passed
        distance_str = request.query_params.get('distance')
        calculated_fare = None
        if distance_str:
            try:
                distance = float(distance_str)
                if distance <= base_distance:
                    calculated_fare = base_fare
                else:
                    calculated_fare = base_fare + math.ceil((distance - base_distance) / 1.0) * rate_per_km
                calculated_fare = round(calculated_fare * surge_multiplier, 2)
            except ValueError:
                pass

        return Response({
            'base_fare': base_fare,
            'rate_per_km': rate_per_km,
            'base_distance': base_distance,
            'surge_multiplier': surge_multiplier,
            'is_surge': surge_multiplier > 1.0,
            'calculated_fare': calculated_fare,
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
    # 10-minute expiration window — ensures drivers see requests even if they just came online
    recent_threshold = timezone.now() - timezone.timedelta(minutes=10)
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
        if channel_layer:
            try:
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
            except Exception as e:
                print(f"WebSocket dispatch error in driver_reject: {e}")
        
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
    log_activity(request.user, "Ride Accepted", f"Driver {request.user.username} accepted Ride #{ride.id} for passenger {ride.passenger.username}", request)
    
    # Notify passenger via Push
    send_push_notification(
        ride.passenger, 
        "Ride Accepted! 🛺", 
        f"Driver {request.user.username} is on the way to pick you up at {ride.pickup_address}."
    )
    
    # Notify passenger via WebSocket (Reliability: Send to both Ride and User groups)
    channel_layer = get_channel_layer()
    if channel_layer:
        try:
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
        except Exception as e:
            print(f"WebSocket dispatch error in driver_accept: {e}")
            
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
    log_activity(request.user, "Ride Completed", f"Driver {request.user.username} completed Ride #{ride.id} (Fare: ₱{total_fare}, LGU Commission: ₱{lgu_commission})", request)

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
        profile_picture_url = None
        if ride.driver.profile_picture:
            profile_picture_url = request.build_absolute_uri(ride.driver.profile_picture.url)

        driver_data = {
            'username': ride.driver.username,
            'vehicle_model': ride.driver.vehicle_model,
            'vehicle_plate': ride.driver.vehicle_plate,
            'vehicle_color': ride.driver.vehicle_color,
            'lat': ride.driver.last_lat,
            'lng': ride.driver.last_lng,
            'rating': ride.driver.average_rating,
            'profile_picture': profile_picture_url
        }

    return Response({
        'id': ride.id,
        'status': ride.status,
        'passenger': ride.passenger.first_name or ride.passenger.username,
        'pickup': ride.pickup_address,
        'destination': ride.dest_address,
        'pickup_lat': ride.pickup_lat,
        'pickup_lng': ride.pickup_lng,
        'dest_lat': ride.dest_lat,
        'dest_lng': ride.dest_lng,
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
        month_start = today.replace(day=1)
        
        rides = Ride.objects.filter(driver=request.user, status='completed')
        
        today_rides = rides.filter(completed_at__date=today)
        week_rides = rides.filter(completed_at__date__gte=week_start)
        month_rides = rides.filter(completed_at__date__gte=month_start)
        
        today_earnings = sum(r.driver_earnings for r in today_rides) if today_rides.exists() else 0
        week_earnings = sum(r.driver_earnings for r in week_rides) if week_rides.exists() else 0
        month_earnings = sum(r.driver_earnings for r in month_rides) if month_rides.exists() else 0
        total_earnings = sum(r.driver_earnings for r in rides) if rides.exists() else 0
        
        trips_today = today_rides.count()
        trips_week = week_rides.count()
        trips_month = month_rides.count()
        
        total_fare_sum = sum(r.fare for r in rides) if rides.exists() else 0
        avg_fare = float(total_fare_sum / rides.count()) if rides.exists() else 0.0
        
        highest_fare = float(max(r.fare for r in rides)) if rides.exists() else 0.0
        
        commission_rate_config = SystemConfig.objects.filter(key='lgu_commission_rate').first()
        commission_rate = float(commission_rate_config.value) if commission_rate_config else 5.0
        
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
            'month': float(month_earnings),
            'total': float(total_earnings),
            'trips_count': rides.count(),
            'trips_today': trips_today,
            'trips_week': trips_week,
            'trips_month': trips_month,
            'avg_fare': avg_fare,
            'highest_fare': highest_fare,
            'commission_rate': commission_rate,
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
            ok, err = verify_pin_with_lockout(pin_obj, pin_code)
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        except TransactionPIN.DoesNotExist:
            return Response({'detail': 'No Transaction PIN set. Please set one in Security Settings.'}, status=status.HTTP_400_BAD_REQUEST)

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
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'pin'

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
        # Update existing PIN — full lockout enforcement
        old_pin = request.data.get('old_pin')
        new_pin = request.data.get('new_pin')

        if not new_pin or len(new_pin) != 6 or not new_pin.isdigit():
            return Response({'detail': 'New PIN must be exactly 6 digits.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pin_obj = TransactionPIN.objects.get(user=request.user)
            ok, err = verify_pin_with_lockout(pin_obj, old_pin)
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

            pin_obj.pin_hash        = make_password(new_pin)
            pin_obj.failed_attempts = 0
            pin_obj.is_locked       = False
            pin_obj.locked_until    = None
            pin_obj.save()
            return Response({'detail': 'Security PIN updated successfully.'})
        except TransactionPIN.DoesNotExist:
            return Response({'detail': 'No PIN found. Please set one first.'}, status=status.HTTP_404_NOT_FOUND)


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
            ok, err = verify_pin_with_lockout(pin_obj, pin_code)
            if not ok:
                raise serializers.ValidationError(err)
        except TransactionPIN.DoesNotExist:
            raise serializers.ValidationError('Please set up your Transaction PIN first.')

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
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins can update withdrawal status.")
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
        user = self.request.user
        if user.role == 'admin':
            return Incident.objects.all().order_by('-created_at')
        return Incident.objects.filter(user=user).order_by('-created_at')

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
        
        # Fetch LGU Dispatcher emergency contacts from SystemConfig
        sos_alert_phone_cfg = SystemConfig.objects.filter(key='sos_alert_phone').first()
        sos_alert_phone = sos_alert_phone_cfg.value.strip() if sos_alert_phone_cfg else ""

        sos_alert_email_cfg = SystemConfig.objects.filter(key='sos_alert_email').first()
        sos_alert_email = sos_alert_email_cfg.value.strip() if sos_alert_email_cfg else ""

        # SMS to personal emergency contact
        if incident.user.emergency_contact_phone:
            personal_msg = (
                f"🚨 EMERGENCY: Your emergency contact {incident.user.username} (Phone: {incident.user.phone_number}) "
                f"has triggered a real-time SOS distress alert on Trento Smart Tricycle System. "
                f"Distress description: {incident.description or 'No details provided'}. "
                f"Last known coordinates: {incident.lat or 'N/A'}, {incident.lng or 'N/A'}."
            )
            send_sms(incident.user.emergency_contact_phone, personal_msg)

        # SMS to global LGU dispatcher contact
        if sos_alert_phone:
            dispatcher_msg = (
                f"🚨 LGU SOS ALERT: User {incident.user.username} (Phone: {incident.user.phone_number}) "
                f"has triggered a real-time SOS alert at {incident.lat or 'N/A'}, {incident.lng or 'N/A'}. "
                f"Details: {incident.description or 'No details provided'}."
            )
            send_sms(sos_alert_phone, dispatcher_msg)

        # Email to global LGU dispatcher
        if sos_alert_email:
            import threading
            def _send_sos_email(recipient_email, user_obj, inc_obj):
                html_msg = f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 2px solid #ef4444; border-radius: 12px; padding: 20px;">
                    <div style="background-color: #ef4444; color: #fff; padding: 15px; text-align: center; border-radius: 8px;">
                        <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">🚨 EMERGENCY SOS ALERT 🚨</h1>
                    </div>
                    <p style="font-size: 16px; margin-top: 20px;">An SOS distress signal has been triggered on the <b>Trento Smart Tricycle Dispatch System</b>.</p>
                    
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fee2e2;">
                        <p style="margin:0 0 10px 0; font-weight: bold; color: #991b1b;">⚠️ Distress Details:</p>
                        <ul style="margin:0; padding-left: 20px; color: #7f1d1d;">
                            <li><b>User:</b> {user_obj.username} ({user_obj.role.capitalize()})</li>
                            <li><b>Phone Number:</b> {user_obj.phone_number or 'N/A'}</li>
                            <li><b>Emergency Description:</b> {inc_obj.description or 'No description provided'}</li>
                            <li><b>Latitude:</b> {inc_obj.lat or 'N/A'}</li>
                            <li><b>Longitude:</b> {inc_obj.lng or 'N/A'}</li>
                            <li><b>Triggered At:</b> {inc_obj.created_at.strftime('%B %d, %Y at %I:%M %p') if inc_obj.created_at else 'Just now'}</li>
                        </ul>
                    </div>

                    <p>Please open the Admin Dashboard or dispatch immediate LGU emergency responders to the user's coordinates.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://trentosmartsystem-production.up.railway.app/admin/" style="display: inline-block; background-color: #ef4444; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open SOS Dispatch Dashboard</a>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="color: #64748b; font-size: 12px; text-align: center;">Trento Smart Automated Emergency Dispatch System</p>
                </div>
                """
                success, response = send_brevo_email(recipient_email, "Trento Emergency Dispatch", f"🚨 EMERGENCY SOS - User {user_obj.username} 🚨", html_msg)
                if success:
                    print(f"[Email] ✅ SOS notification email sent to {recipient_email}")
                else:
                    print(f"[Email] ❌ SOS notification email FAILED: {response}")

            threading.Thread(target=_send_sos_email, args=(sos_alert_email, incident.user, incident), daemon=True).start()

        # Log to audit trails
        log_activity(
            user=self.request.user,
            action="SOS Triggered",
            details=f"Distress SOS initiated by {self.request.user.username} at location {incident.lat or 'N/A'}, {incident.lng or 'N/A'}. Incident Ref: #{incident.id}.",
            request=self.request
        )


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
        if self.action in ['update', 'partial_update', 'create', 'destroy']:
            return [IsAuthenticated(), IsAdminRole()]
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
        ok, err = check_admin_pin(self.request)
        if not ok:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(detail=err)

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
        heading = request.data.get('heading')
        accuracy = request.data.get('accuracy')

        if lat is None or lng is None:
            return Response(
                {'detail': 'Both "lat" and "lng" are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(lat)
            lng = float(lng)
            if heading is not None:
                heading = float(heading)
            if accuracy is not None:
                accuracy = float(accuracy)
        except (ValueError, TypeError):
            return Response(
                {'detail': '"lat" and "lng" must be valid numbers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Persist to user model (same fields used by the existing driver tracker)
        user = request.user
        
        # Security: Check for impossible travel / GPS Spoofing
        from .fraud_service import FraudDetectionService
        is_spoofed = FraudDetectionService.check_impossible_travel(user, lat, lng)
        if is_spoofed:
            return Response(
                {'detail': 'Suspicious location activity detected. Your account has been flagged and forced offline.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.last_lat = lat
        user.last_lng = lng
        user.last_location_update = timezone.now()
        user.save(update_fields=['last_lat', 'last_lng', 'last_location_update'])

        # Route Anomaly Detection
        if user.role == 'driver':
            from .models import FraudAlert
            active_ride = Ride.objects.filter(driver=user, status='on_route').first()
            if active_ride and active_ride.dest_lat and active_ride.dest_lng:
                dist_to_dest = calculate_distance(lat, lng, float(active_ride.dest_lat), float(active_ride.dest_lng))
                # For a typical local tricycle ride, being >10km away while on route is highly anomalous
                if dist_to_dest > 10.0:
                    FraudAlert.objects.create(
                        user=user,
                        reason="Route Anomaly Detection",
                        details=f"Driver is {dist_to_dest:.2f}km away from destination while on route for Ride #{active_ride.id}.",
                        severity='critical'
                    )
                    try:
                        channel_layer = get_channel_layer()
                        async_to_sync(channel_layer.group_send)(
                            'global_system',
                            {
                                'type': 'system_event',
                                'event': {
                                    'type': 'route_anomaly',
                                    'message': f"⚠️ Route Anomaly: Driver {user.username} is significantly off-route (Ride #{active_ride.id}).",
                                    'timestamp': timezone.now().isoformat()
                                }
                            }
                        )
                        # Alert Passenger
                        async_to_sync(channel_layer.group_send)(
                            f'user_{active_ride.passenger.id}',
                            {
                                'type': 'system_event',
                                'event': {
                                    'type': 'safety_alert',
                                    'message': "Route Anomaly Detected: Your driver appears to be off-route. Are you okay? Use the SOS button if you need help.",
                                    'severity': 'high'
                                }
                            }
                        )
                    except Exception as e:
                        print(f"Failed to broadcast route anomaly: {e}")

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
                        'heading': heading,
                        'accuracy': accuracy,
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


class VerifyEmailView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        otp = request.data.get('otp')

        if not email or not otp:
            return Response({'detail': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'detail': 'User with this email not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified:
            return Response({'detail': 'Email already verified.'}, status=status.HTTP_200_OK)

        is_valid_otp = user.email_otp and user.email_otp == otp

        if is_valid_otp:
            user.is_email_verified = True
            user.email_otp = None  # Clear OTP after successful verification
            user.save(update_fields=['is_email_verified', 'email_otp'])
            return Response({'detail': 'Email verified successfully! You can now log in.'}, status=status.HTTP_200_OK)
        else:
            return Response({'detail': 'Invalid OTP code. Please check your email or request a new code.'}, status=status.HTTP_400_BAD_REQUEST)


class ResendOTPView(APIView):
    """
    Resends a fresh 6-digit OTP to the user's registered email.
    Rate-limited to prevent abuse.
    """
    permission_classes = (AllowAny,)
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'resend_otp'

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            # Don't reveal whether the email exists (security best practice)
            return Response({'detail': 'If this email is registered, a new code has been sent.'}, status=status.HTTP_200_OK)

        if user.is_email_verified:
            return Response({'detail': 'This email is already verified. Please log in.'}, status=status.HTTP_200_OK)

        # Generate a fresh 6-digit OTP
        new_otp = ''.join(random.choices(string.digits, k=6))
        user.email_otp = new_otp
        user.save(update_fields=['email_otp'])
        print(f"👉 [DEMO/LOG] Generated new OTP for {email}: {new_otp}")

        # Send the new OTP via email
        import threading
        from django.core.mail import send_mail
        from django.conf import settings as django_settings

        def _send_resend_email(username, email_addr, otp_code):
            try:
                html_msg = f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2>Your New Trento Smart Verification Code 🛺</h2>
                    <p>Hi {username},</p>
                    <p>You requested a new verification code for your Trento Smart account.</p>
                    <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 12px; margin: 20px 0;">
                        <h1 style="font-size: 36px; letter-spacing: 8px; color: #2563eb; margin: 0;">{otp_code}</h1>
                    </div>
                    <p>This code expires in 30 minutes. Do not share it with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                    <p style="color: #64748b; font-size: 12px; text-align: center;">If you did not request this, please ignore this email or contact support immediately.</p>
                </div>
                """
                success, response = send_brevo_email(email_addr, username, 'Your New Trento Smart Verification Code 🛺', html_msg)
                if success:
                    print(f"[Email] ✅ Resend OTP sent to {email_addr}")
                else:
                    print(f"[Email] ❌ Resend OTP FAILED for {email_addr}: {response}")
            except Exception as e:
                print(f"[Email] ❌ Resend OTP Exception: {e}")

        thread = threading.Thread(
            target=_send_resend_email,
            args=(user.username, user.email, new_otp),
            daemon=True
        )
        thread.start()

        return Response({'detail': 'A new verification code has been sent to your email.'}, status=status.HTTP_200_OK)


class TestEmailView(APIView):
    permission_classes = (AllowAny,)
    
    def post(self, request):
        email = request.data.get('email')
        try:
            success, response = send_brevo_email(email, "Tester", "Brevo API Test", "<p>Testing Brevo API integration from Railway.</p>")
            if success:
                return Response({'status': 'success', 'data': response})
            else:
                return Response({'status': 'error', 'detail': response}, status=500)
        except Exception as e:
            return Response({'status': 'error', 'detail': str(e)}, status=500)

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
import threading

class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes   = (ScopedRateThrottle,)
    throttle_scope     = 'resend_otp'

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        
        # Always return success to prevent email enumeration
        response_msg = {'detail': 'If this email is registered, a password reset link has been sent.'}
        
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            
            # Combine uid-token
            combined_token = f'{uid}-{token}'
            
            # Pass this combined_token to the frontend URL
            reset_link = f'https://trentosmart-system.vercel.app/reset-password?token={combined_token}'
            
            def _send_reset_email(username, email_addr, link):
                try:
                    html_msg = f"""
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2>Password Reset Request 🔐</h2>
                        <p>Hi {username},</p>
                        <p>We received a request to reset your password for Trento Smart. Click the button below to choose a new password.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{link}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        <p>This link expires in a few hours. If you did not request a password reset, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="color: #64748b; font-size: 12px; text-align: center;">Trento Smart Admin</p>
                    </div>
                    """
                    success, resp = send_brevo_email(email_addr, username, 'Trento Smart Password Reset', html_msg)
                    if success:
                        print(f"[Email] ✅ Password reset sent to {email_addr}")
                    else:
                        print(f"[Email] ❌ Password reset FAILED for {email_addr}: {resp}")
                except Exception as e:
                    print(f"[Email] ❌ Password reset Exception: {e}")

            thread = threading.Thread(
                target=_send_reset_email,
                args=(user.username, user.email, reset_link),
                daemon=True
            )
            thread.start()

        return Response(response_msg, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        if not token or not new_password:
            return Response({'detail': 'Token and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid_b64, reset_token = token.rsplit('-', 1)
            uid = force_str(urlsafe_base64_decode(uid_b64))
            
            User = get_user_model()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'Invalid or malformed token.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, reset_token):
            return Response({'detail': 'Token is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'detail': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        
        return Response({'detail': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)


class ActivityLogViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return ActivityLog.objects.all().select_related('user').order_by('-created_at')
        return ActivityLog.objects.filter(user=self.request.user).select_related('user').order_by('-created_at')


class ScheduledRideViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduledRideSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return ScheduledRide.objects.all().order_by('-created_at')
        return ScheduledRide.objects.filter(passenger=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # Enforce passenger capacity
        passenger_count = self.request.data.get('passenger_count', 1)
        try:
            passenger_count = int(passenger_count)
        except (ValueError, TypeError):
            passenger_count = 1

        max_capacity_cfg = SystemConfig.objects.filter(key='max_capacity').first()
        max_capacity = 5
        if max_capacity_cfg:
            try:
                max_capacity = int(max_capacity_cfg.value)
            except ValueError:
                pass

        if passenger_count > max_capacity:
            raise serializers.ValidationError({"detail": f"Passenger count cannot exceed the tricycle capacity of {max_capacity} passengers."})
        if passenger_count < 1:
            raise serializers.ValidationError({"detail": "Passenger count must be at least 1."})

        from django.db import DatabaseError
        try:
            scheduled_ride = serializer.save(
                passenger=self.request.user, 
                status='pending',
                passenger_count=passenger_count
            )
        except DatabaseError as db_err:
            error_msg = str(db_err)
            print(f"[ScheduledRideViewSet] DB DatabaseError during scheduled ride creation: {error_msg}")
            raise serializers.ValidationError({
                "detail": "Scheduled ride creation failed due to a database or server configuration issue. Please ensure all database migrations are applied.",
                "server_error": error_msg
            })

        log_activity(
            user=self.request.user,
            action="Scheduled Ride Created",
            details=f"Scheduled ride #{scheduled_ride.id} for {passenger_count} passenger(s) from {scheduled_ride.pickup_address} to {scheduled_ride.dest_address} for {scheduled_ride.scheduled_date} at {scheduled_ride.scheduled_time}",
            request=self.request
        )

    def perform_update(self, serializer):
        # Enforce passenger capacity
        passenger_count = self.request.data.get('passenger_count')
        if passenger_count is not None:
            try:
                passenger_count = int(passenger_count)
            except (ValueError, TypeError):
                passenger_count = 1

            max_capacity_cfg = SystemConfig.objects.filter(key='max_capacity').first()
            max_capacity = 5
            if max_capacity_cfg:
                try:
                    max_capacity = int(max_capacity_cfg.value)
                except ValueError:
                    pass

            if passenger_count > max_capacity:
                raise serializers.ValidationError({"detail": f"Passenger count cannot exceed the tricycle capacity of {max_capacity} passengers."})
            if passenger_count < 1:
                raise serializers.ValidationError({"detail": "Passenger count must be at least 1."})

        scheduled_ride = serializer.save()
        log_activity(
            user=self.request.user,
            action="Scheduled Ride Updated",
            details=f"Updated scheduled ride #{scheduled_ride.id} - from {scheduled_ride.pickup_address} to {scheduled_ride.dest_address} for {scheduled_ride.scheduled_date} at {scheduled_ride.scheduled_time}",
            request=self.request
        )

    def perform_destroy(self, instance):
        log_activity(
            user=self.request.user,
            action="Scheduled Ride Cancelled",
            details=f"Cancelled scheduled ride #{instance.id} scheduled for {instance.scheduled_date} at {instance.scheduled_time}",
            request=self.request
        )
        instance.delete()




