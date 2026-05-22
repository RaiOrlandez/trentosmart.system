from django.utils import timezone
from .models import FraudAlert, Withdrawal, Ride

import math


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great-circle distance between two points in kilometres."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class FraudDetectionService:
    # ─────────────────────────────────────────────
    # Rule 1: Withdrawal Velocity
    # ─────────────────────────────────────────────
    @staticmethod
    def check_withdrawal_velocity(user, amount):
        """
        Flag if a user withdraws more than 3 times in 1 hour
        OR requests an unusually large single withdrawal.
        """
        one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
        recent_withdrawals = Withdrawal.objects.filter(
            user=user, created_at__gte=one_hour_ago
        ).count()

        if recent_withdrawals >= 3:
            FraudAlert.objects.get_or_create(
                user=user,
                reason="High Withdrawal Frequency",
                is_resolved=False,
                defaults={
                    'details': f"User attempted {recent_withdrawals + 1}th withdrawal within 1 hour.",
                    'severity': 'medium',
                }
            )
            return True  # Blocked

        if amount > 5000:
            FraudAlert.objects.create(
                user=user,
                reason="Large Withdrawal Amount",
                details=f"User requested a withdrawal of ₱{amount:.2f}.",
                severity='low',
            )
            return False  # Logged, not blocked

        return False

    # ─────────────────────────────────────────────
    # Rule 2: Impossible Travel / GPS Spoofing
    # ─────────────────────────────────────────────
    @staticmethod
    def check_impossible_travel(user, new_lat, new_lng):
        """
        Flag if the implied speed between two location updates exceeds 100 km/h
        (physically impossible for a tricycle), indicating GPS spoofing.
        """
        if not user.last_lat or not user.last_lng or not user.last_location_update:
            return False

        last_lat = float(user.last_lat)
        last_lng = float(user.last_lng)

        distance_km = haversine_distance(last_lat, last_lng, new_lat, new_lng)
        time_delta_hours = (timezone.now() - user.last_location_update).total_seconds() / 3600.0

        if time_delta_hours <= 0:
            return False

        speed_kmh = distance_km / time_delta_hours

        # Ignore GPS jitter: must be >1 min elapsed AND >100 m moved
        if speed_kmh > 100 and time_delta_hours > (1 / 60.0) and distance_km > 0.1:
            FraudAlert.objects.create(
                user=user,
                reason="Impossible Travel / GPS Spoofing",
                details=(
                    f"Moved {distance_km:.2f} km in {time_delta_hours * 60:.1f} min "
                    f"(implied speed: {speed_kmh:.1f} km/h)."
                ),
                severity='critical',
            )
            # Force driver offline as an immediate penalty
            if getattr(user, 'is_online', False):
                user.is_online = False
                user.save(update_fields=['is_online'])
            return True

        return False

    # ─────────────────────────────────────────────
    # Rule 3: Ride Cancellation Abuse
    # ─────────────────────────────────────────────
    @staticmethod
    def check_cancellation_abuse(user):
        """
        Flag drivers who cancel 5 or more rides within a 2-hour window.
        Flag passengers who cancel 3 or more rides within 1 hour.
        This helps detect bait-and-switch or demand-gaming behaviour.
        """
        now = timezone.now()

        if getattr(user, 'role', None) == 'driver':
            window = now - timezone.timedelta(hours=2)
            threshold = 5
            role_label = "Driver"
        else:
            window = now - timezone.timedelta(hours=1)
            threshold = 3
            role_label = "Passenger"

        cancelled = Ride.objects.filter(
            **{('driver' if user.role == 'driver' else 'passenger'): user},
            status='cancelled',
            requested_at__gte=window,
        ).count()

        if cancelled >= threshold:
            _, created = FraudAlert.objects.get_or_create(
                user=user,
                reason=f"{role_label} Cancellation Abuse",
                is_resolved=False,
                defaults={
                    'details': (
                        f"{role_label} cancelled {cancelled} rides in the last "
                        f"{'2 hours' if user.role == 'driver' else '1 hour'}."
                    ),
                    'severity': 'high',
                }
            )
            return True

        return False

    # ─────────────────────────────────────────────
    # Rule 4: Account Velocity (New account, rapid activity)
    # ─────────────────────────────────────────────
    @staticmethod
    def check_new_account_abuse(user, amount):
        """
        Flag if a newly created account (< 24 hours old) attempts
        a large withdrawal or more than 2 transactions.
        """
        account_age_hours = (timezone.now() - user.date_joined).total_seconds() / 3600.0

        if account_age_hours < 24:
            if amount > 500:
                FraudAlert.objects.create(
                    user=user,
                    reason="New Account Large Transaction",
                    details=(
                        f"Account is only {account_age_hours:.1f} hrs old "
                        f"and attempted a ₱{amount:.2f} withdrawal."
                    ),
                    severity='high',
                )
                return True

        return False

    # ─────────────────────────────────────────────
    # Convenience: Run all checks in one call
    # ─────────────────────────────────────────────
    @classmethod
    def run_all_location_checks(cls, user, new_lat, new_lng):
        """Run every location-based fraud rule for a given location update."""
        results = {
            'impossible_travel': cls.check_impossible_travel(user, new_lat, new_lng),
            'cancellation_abuse': cls.check_cancellation_abuse(user),
        }
        return results

    @classmethod
    def run_all_withdrawal_checks(cls, user, amount):
        """Run every withdrawal-based fraud rule."""
        results = {
            'velocity': cls.check_withdrawal_velocity(user, amount),
            'new_account': cls.check_new_account_abuse(user, amount),
        }
        return results
