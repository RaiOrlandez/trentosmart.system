from django.utils import timezone
from .models import FraudAlert, Withdrawal, Ride

import math

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

class FraudDetectionService:
    @staticmethod
    def check_withdrawal_velocity(user, amount):
        """
        Rule: Flag if user withdraws more than 3x in 1 hour OR withdraws unusually large amount.
        """
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        recent_withdrawals = Withdrawal.objects.filter(user=user, created_at__gte=one_hour_ago).count()
        
        if recent_withdrawals >= 3:
            FraudAlert.objects.create(
                user=user,
                reason="High Withdrawal Frequency",
                details=f"User attempted {recent_withdrawals + 1}th withdrawal in 1 hour.",
                severity='medium'
            )
            return True # Flagged
            
        if amount > 5000: # Threshold for manual review
             FraudAlert.objects.create(
                user=user,
                reason="Large Withdrawal Amount",
                details=f"User requested withdrawal of {amount}",
                severity='low'
            )
             # We don't block low severity, just log
             return False
             
        return False

    @staticmethod
    def check_impossible_travel(user, new_lat, new_lng):
        """
        Rule: Flag if user moves faster than physically possible (e.g. > 100km/h implied speed between updates).
        """
        if not user.last_lat or not user.last_lng or not user.last_location_update:
            return False

        last_lat = float(user.last_lat)
        last_lng = float(user.last_lng)
        
        # Calculate distance in km
        distance_km = haversine_distance(last_lat, last_lng, new_lat, new_lng)
        
        # Calculate time delta in hours
        time_delta_hours = (timezone.now() - user.last_location_update).total_seconds() / 3600.0
        
        if time_delta_hours <= 0:
            return False

        speed_kmh = distance_km / time_delta_hours

        # Tricycles rarely exceed 60 km/h. If implied speed is > 100 km/h, flag as spoofing.
        # Ignore very small time deltas (under 1 min) or tiny movements (under 100m) to prevent GPS jitter false positives.
        if speed_kmh > 100 and time_delta_hours > (1/60.0) and distance_km > 0.1:
            FraudAlert.objects.create(
                user=user,
                reason="Impossible Travel / GPS Spoofing",
                details=f"User moved {distance_km:.2f}km in {time_delta_hours * 60:.1f} minutes. Implied speed: {speed_kmh:.1f} km/h.",
                severity='critical'
            )
            # Force driver offline as penalty for spoofing
            if user.is_online:
                user.is_online = False
                user.save(update_fields=['is_online'])
            return True
            
        return False
