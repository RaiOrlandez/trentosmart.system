from django.db import models
import uuid
from django.contrib.auth.models import AbstractUser, Group, Permission



class User(AbstractUser):
    # Override many-to-many reverse accessors to avoid clashes with auth.User
    groups = models.ManyToManyField(
        Group,
        related_name='api_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        related_query_name='user',
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name='api_user_set',
        blank=True,
        help_text='Specific permissions for this user.',
        related_query_name='user',
    )
    ROLE_CHOICES = (

        ('passenger', 'Passenger'),
        ('driver', 'Driver'),
        ('admin', 'Admin'),
    )
    VERIFICATION_CHOICES = (
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('suspended', 'Suspended')
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='passenger')
    is_verified_driver = models.BooleanField(default=False)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='pending')
    fcm_device_token = models.CharField(max_length=255, blank=True, null=True)
    
    # Driver Verification fields
    license_number = models.CharField(max_length=50, blank=True)
    license_image = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    permit_number = models.CharField(max_length=50, blank=True)
    permit_image = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    
    phone_number = models.CharField(max_length=20, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    
    # New Personal Details
    address = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    gender = models.CharField(max_length=20, choices=(('male', 'Male'), ('female', 'Female'), ('other', 'Other')), blank=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=100, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    
    # Strict Driver Verification
    body_number = models.CharField(max_length=50, blank=True) # LGU Unit ID
    license_expiry_date = models.DateField(null=True, blank=True)
    nbi_clearance_image = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    barangay_residency_image = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    selfie_with_license = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    vehicle_orcr_image = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    tricycle_photo = models.ImageField(upload_to='driver_docs/', null=True, blank=True)
    
    # Strict Passenger Verification
    government_id_image = models.ImageField(upload_to='passenger_docs/', null=True, blank=True)
    
    # Vehicle Details
    vehicle_model = models.CharField(max_length=100, blank=True)
    vehicle_color = models.CharField(max_length=50, blank=True)
    sidecar_type = models.CharField(max_length=50, blank=True) # e.g. Roofed, Standard
    vehicle_plate = models.CharField(max_length=50, blank=True)
    
    wallet_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Email Verification
    is_email_verified = models.BooleanField(default=False)
    email_otp = models.CharField(max_length=6, blank=True, null=True)

    # Session management to prevent concurrent logins
    jwt_session_salt = models.CharField(max_length=255, default=uuid.uuid4)

    # Driver Operational Settings
    auto_accept_rides = models.BooleanField(default=False)
    receive_notifications = models.BooleanField(default=True)
    search_radius_km = models.IntegerField(default=5)

    # Location Tracking (for Drivers)
    last_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"
    
    @property
    def average_rating(self):
        reviews = self.received_reviews.all()
        if not reviews.exists():
            return 0
        return sum([r.rating for r in reviews]) / reviews.count()


class Ride(models.Model):
    STATUS_CHOICES = (
        ('requested', 'Requested'),
        ('accepted', 'Accepted'),
        ('on_route', 'On Route'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    )
    passenger = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='rides')
    driver = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_rides')
    targeted_driver = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='requested_targeted_rides')
    pickup_address = models.CharField(max_length=255, blank=True)
    dest_address = models.CharField(max_length=255, blank=True)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    dest_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    dest_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    fare = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    passenger_count = models.IntegerField(default=1)
    nearest_landmark = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    
    # LGU Commission System (5% default)
    lgu_commission = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    driver_earnings = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)  # Percentage
    
    requested_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    share_token = models.UUIDField(default=uuid.uuid4, editable=False)
    
    # Cancellation tracking
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey('api.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='cancelled_rides')
    
    # List of drivers who declined this request
    rejected_by = models.ManyToManyField('api.User', blank=True, related_name='rejected_rides')

    # History display controls (Soft delete per role)
    hidden_from_passenger = models.BooleanField(default=False)
    hidden_from_driver = models.BooleanField(default=False)

    def __str__(self):
        return f"Ride {self.id} - {self.status}"


class Payment(models.Model):
    METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('gcash', 'GCash'),
    )
    ride = models.OneToOneField(Ride, on_delete=models.CASCADE, related_name='payment')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='cash')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    paid = models.BooleanField(default=False)
    provider_txn = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"Payment {self.id} - {self.method} - {self.amount}"


class Incident(models.Model):
    user = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True, blank=True)
    ride = models.ForeignKey(Ride, null=True, blank=True, on_delete=models.SET_NULL)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='pending') # pending, active, resolved, dismissed
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Incident {self.id} by {self.user}"


class WalletTransaction(models.Model):
    TXN_TYPES = (
        ('topup', 'Top-up'),
        ('payment', 'Ride Payment'),
        ('refund', 'Refund'),
        ('cashout', 'Cash Out'),
        ('lgu_commission', 'LGU Commission'),
        ('driver_earning', 'Driver Earning'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallet_transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TXN_TYPES)
    reference_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} ({self.user.username})"


class Withdrawal(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='withdrawals')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=50, default='GCash')
    account_number = models.CharField(max_length=50)
    account_name = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reference_id = models.CharField(max_length=100, blank=True)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Withdrawal {self.id} - {self.user.username} - {self.amount}"


class Review(models.Model):
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_reviews')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_reviews')
    rating = models.IntegerField(default=5)  # 1-5 stars
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review by {self.reviewer.username} for {self.reviewee.username} - {self.rating} Stars"


class Complaint(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='complaints')
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='complaints', null=True, blank=True)
    subject = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(max_length=20, default='pending') # pending, investigation, closed
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Complaint {self.id} - {self.user.username}"


class SystemConfig(models.Model):
    key = models.CharField(max_length=50, unique=True)
    value = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.key}: {self.value}"


class Broadcast(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='broadcasts')
    title = models.CharField(max_length=255)
    message = models.TextField()
    target_role = models.CharField(max_length=20, default='all') # all, driver, passenger
    is_critical = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Broadcast: {self.title} by {self.user.username}"


class SavedPlace(models.Model):
    CATEGORY_CHOICES = (
        ('home', 'Home'),
        ('work', 'Work'),
        ('school', 'School'),
        ('market', 'Market'),
        ('other', 'Other'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_places')
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class MaintenanceLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='maintenance_logs')
    service_type = models.CharField(max_length=100) # e.g. Oil Change, Tire Check, Brake Fix
    description = models.TextField(blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    service_date = models.DateField()
    next_service_date = models.DateField(null=True, blank=True)
    odometer_reading = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.service_type} - {self.user.username} - {self.service_date}"

class TransactionPIN(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='transaction_pin')
    pin_hash = models.CharField(max_length=255) # Store encrypted pin
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    failed_attempts = models.IntegerField(default=0)
    is_locked = models.BooleanField(default=False)
    locked_until = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"PIN for {self.user.username}"


class FraudAlert(models.Model):
    SEVERITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('critical', 'Critical'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fraud_alerts')
    reason = models.CharField(max_length=255)
    details = models.TextField(blank=True) # JSON or text details of the event
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Fraud Alert ({self.severity}): {self.user.username} - {self.reason}"


class LGURevenue(models.Model):
    """
    Tracks all LGU commission collected from completed rides.
    Purpose: System maintenance, emergency fund, regulatory compliance, driver benefits.
    """
    PURPOSE_CHOICES = (
        ('system_maintenance', 'System Maintenance'),
        ('emergency_fund', 'Emergency Fund'),
        ('regulatory', 'Regulatory Compliance'),
        ('driver_benefits', 'Driver Benefits'),
        ('general', 'General Fund'),
    )
    
    ride = models.OneToOneField(Ride, on_delete=models.CASCADE, related_name='lgu_revenue')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)  # Percentage used
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, default='general')
    collected_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'LGU Revenue'
        verbose_name_plural = 'LGU Revenues'
        ordering = ['-collected_at']
    
    def __str__(self):
        return f"LGU Revenue ₱{self.amount} from Ride #{self.ride.id} ({self.purpose})"


class ActivityLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} at {self.created_at}"


class ScheduledRide(models.Model):
    """
    Allows passengers to pre-book tricycle rides up to 30 days in advance.
    Supports one-time, daily, and weekly recurring schedules.
    The admin or a background task can dispatch these when the time arrives.
    """
    RECURRING_CHOICES = (
        ('none',   'One-time'),
        ('daily',  'Daily'),
        ('weekly', 'Weekly'),
    )
    PAYMENT_CHOICES = (
        ('cash',   'Cash'),
        ('gcash',  'GCash'),
        ('wallet', 'Wallet'),
    )
    STATUS_CHOICES = (
        ('pending',    'Pending'),
        ('dispatched', 'Dispatched'),
        ('cancelled',  'Cancelled'),
        ('expired',    'Expired'),
    )

    passenger       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scheduled_rides')
    pickup_address  = models.CharField(max_length=255)
    dest_address    = models.CharField(max_length=255)
    scheduled_date  = models.DateField()
    scheduled_time  = models.TimeField()
    recurring       = models.CharField(max_length=10, choices=RECURRING_CHOICES, default='none')
    payment_method  = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    notes           = models.TextField(blank=True)
    passenger_count = models.IntegerField(default=1)
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    # Optional: linked Ride when dispatched
    ride = models.OneToOneField(
        Ride, null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='scheduled_ride'
    )

    class Meta:
        ordering = ['scheduled_date', 'scheduled_time']

    def __str__(self):
        return f"ScheduledRide #{self.id} by {self.passenger.username} on {self.scheduled_date} {self.scheduled_time}"
