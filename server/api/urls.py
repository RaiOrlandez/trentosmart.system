from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, LoginView, ProfileView, RideViewSet, driver_requests, 
    driver_accept, DriverVerificationView, WalletViewSet,
    ReviewViewSet, IncidentViewSet, ComplaintViewSet, UserViewSet,
    DriverAnalyticsView, SavedPlaceViewSet, SystemConfigViewSet, BroadcastViewSet,
    WithdrawalViewSet, MaintenanceLogViewSet, PINManagementView
)

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
    path('security/pin/', PINManagementView.as_view(), name='security-pin'),
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('user/profile/', ProfileView.as_view(), name='profile'),
    path('', include(router.urls)),
    path('driver/requests/', driver_requests, name='driver_requests'),
    path('driver/accept/<int:ride_id>/', driver_accept, name='driver_accept'),
    path('driver/verify/', DriverVerificationView.as_view(), name='driver_verify'),
    path('driver/analytics/', DriverAnalyticsView.as_view(), name='driver_analytics'),
]
