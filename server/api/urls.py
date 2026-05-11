from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CheckEmailView, CheckUsernameView, LoginView, ProfileView, RideViewSet, driver_requests, 
    driver_accept, driver_reject, ride_complete, DriverVerificationView, WalletViewSet,
    ReviewViewSet, IncidentViewSet, ComplaintViewSet, UserViewSet,
    DriverAnalyticsView, SavedPlaceViewSet, SystemConfigViewSet, BroadcastViewSet,
    WithdrawalViewSet, MaintenanceLogViewSet, PINManagementView, track_ride,
    LocationUpdateView, NearbyLocationsView,
)
from .fcm_views import update_fcm_token
from .report_views import export_revenue_csv


router = DefaultRouter()
router.register(r'withdrawals', WithdrawalViewSet, basename='withdrawal')
router.register(r'users', UserViewSet, basename='user')
router.register(r'rides', RideViewSet, basename='ride')
router.register(r'wallet', WalletViewSet, basename='wallet')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'complaints', ComplaintViewSet, basename='complaint')
router.register(r'saved-places', SavedPlaceViewSet, basename='saved-place')
router.register(r'system-config', SystemConfigViewSet, basename='system-config')
router.register(r'broadcasts', BroadcastViewSet, basename='broadcast')
router.register(r'maintenance-logs', MaintenanceLogViewSet, basename='maintenance-log')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/check-email/', CheckEmailView.as_view(), name='check-email'),
    path('auth/check-username/', CheckUsernameView.as_view(), name='check-username'),
    path('security/pin/', PINManagementView.as_view(), name='security-pin'),
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/profile/', ProfileView.as_view(), name='profile'),
    path('', include(router.urls)),
    path('driver/requests/', driver_requests, name='driver_requests'),
    path('driver/accept/<int:ride_id>/', driver_accept, name='driver_accept'),
    path('driver/reject/<int:ride_id>/', driver_reject, name='driver_reject'),
    path('rides/<int:ride_id>/complete/', ride_complete, name='ride_complete'),
    path('driver/verify/', DriverVerificationView.as_view(), name='driver_verify'),
    path('driver/analytics/', DriverAnalyticsView.as_view(), name='driver_analytics'),
    path('ride/track/<str:token>/', track_ride, name='public_track_ride'),
    # ── Real-time Location Tracking (all roles) ──────────────────────────────
    path('location/update/', LocationUpdateView.as_view(), name='location_update'),
    path('location/nearby/', NearbyLocationsView.as_view(), name='location_nearby'),
    
    # ── FCM Push Notifications ───────────────────────────────────────────────
    path('auth/update-fcm-token/', update_fcm_token, name='update_fcm_token'),
    
    # ── Export & Reports ──────────────────────────────────────────────────────
    path('reports/export/', export_revenue_csv, name='export_revenue_csv'),
]

