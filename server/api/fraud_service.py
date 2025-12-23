from django.utils import timezone
from .models import FraudAlert, Withdrawal, Ride

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
        Implementation simplified for now: just basic boundary check.
        """
        # (Implementation placeholder for future geolocation math)
        pass
