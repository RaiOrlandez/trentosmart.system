from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.db.models import Sum
from .models import User, Ride, Payment, Incident, FraudAlert, LGURevenue, ActivityLog, Withdrawal


class TrikeAdminSite(admin.AdminSite):
    site_header = "TRENTO SMART TRICYCLE ADMIN"
    site_title = "Smart Trike Admin Portal"
    index_title = "Dispatch Management Console"
    enable_nav_sidebar = True

    def index(self, request, extra_context=None):
        extra_context = extra_context or {}
        # Get real-time stats for the dashboard
        extra_context['total_users'] = User.objects.count()
        extra_context['active_rides'] = Ride.objects.filter(status__in=['accepted', 'on_route']).count()
        extra_context['total_revenue'] = Payment.objects.filter(paid=True).aggregate(Sum('amount'))['amount__sum'] or 0
        extra_context['incident_count'] = Incident.objects.count()
        return super().index(request, extra_context)

admin_site = TrikeAdminSite(name='trike_admin')

@admin.register(User, site=admin_site)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role_badge', 'verified_status', 'is_staff')
    list_filter = ('role', 'is_verified_driver', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    
    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Smart Tricycle Settings', {'fields': ('role', 'is_verified_driver')}),
        ('Driver Verification Documents', {'fields': (
            'license_number', 'license_image', 'license_preview', 
            'permit_number', 'permit_image', 'permit_preview', 
            'verification_notes'
        )}),
    )
    readonly_fields = ('license_preview', 'permit_preview')
    actions = ['verify_drivers']

    @admin.action(description='Verify selected drivers')
    def verify_drivers(self, request, queryset):
        updated = queryset.filter(role='driver').update(is_verified_driver=True)
        self.message_user(request, f"{updated} drivers were successfully verified.")

    def license_preview(self, obj):
        if obj.license_image:
            return format_html('<img src="{}" style="max-height: 200px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"/>', obj.license_image.url)
        return "No License Uploaded"
    license_preview.short_description = 'License Preview'

    def permit_preview(self, obj):
        if obj.permit_image:
            return format_html('<img src="{}" style="max-height: 200px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"/>', obj.permit_image.url)
        return "No Permit Uploaded"
    permit_preview.short_description = 'Permit Preview'

    def role_badge(self, obj):
        colors = {
            'admin': '#ef4444',    # Red
            'driver': '#fbbf24',   # Amber
            'passenger': '#3b82f6' # Blue
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold; text-transform: uppercase; font-size: 10px;">{}</span>',
            colors.get(obj.role, '#64748b'),
            obj.role
        )
    role_badge.short_description = 'Role'

    def verified_status(self, obj):
        if obj.role != 'driver':
            return "-"
        icon = "✅" if obj.is_verified_driver else "❌"
        color = "green" if obj.is_verified_driver else "red"
        return format_html('<b style="color: {};">{} {}</b>', color, icon, "Verified" if obj.is_verified_driver else "Pending")
    verified_status.short_description = 'Verification'

@admin.register(Ride, site=admin_site)
class RideAdmin(admin.ModelAdmin):
    list_display = ('id', 'passenger_info', 'driver_info', 'status_badge', 'fare_display', 'requested_at')
    list_filter = ('status', 'requested_at')
    search_fields = ('passenger__username', 'driver__username', 'pickup_address', 'dest_address')
    readonly_fields = ('requested_at', 'accepted_at', 'started_at', 'completed_at')
    
    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }
    
    def passenger_info(self, obj):
        return format_html('<b>{}</b>', obj.passenger.username)
    passenger_info.short_description = 'Passenger'

    def driver_info(self, obj):
        if not obj.driver:
            return format_html('<i style="color: #94a3b8;">Searching...</i>')
        return obj.driver.username
    driver_info.short_description = 'Driver'

    def status_badge(self, obj):
        colors = {
            'requested': '#f59e0b',
            'accepted': '#3b82f6',
            'on_route': '#8b5cf6',
            'completed': '#10b981',
            'cancelled': '#ef4444',
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold;">{}</span>',
            colors.get(obj.status, '#64748b'),
            obj.status.upper()
        )
    status_badge.short_description = 'Status'

    def fare_display(self, obj):
        if obj.fare:
            return format_html('<span style="font-weight: bold; color: #059669;">₱{:.2f}</span>', obj.fare)
        return "-"
    fare_display.short_description = 'Fare'

@admin.register(Payment, site=admin_site)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride_link', 'method', 'amount_display', 'payment_status')
    list_filter = ('method', 'paid')
    search_fields = ('provider_txn', 'ride__id')
    
    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }
    
    def ride_link(self, obj):
        return format_html('<a href="../ride/{}/change/">Ride #{}</a>', obj.ride.id, obj.ride.id)
    ride_link.short_description = 'Related Ride'

    def amount_display(self, obj):
        return format_html('<b>₱{}</b>', obj.amount)
    amount_display.short_description = 'Amount'

    def payment_status(self, obj):
        color = "green" if obj.paid else "orange"
        text = "PAID" if obj.paid else "PENDING"
        return format_html('<strong style="color: {};">{}</strong>', color, text)
    payment_status.short_description = 'Status'

@admin.register(Incident, site=admin_site)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'ride_ref', 'created_at', 'emergency_flag')
    list_filter = ('created_at',)
    search_fields = ('description', 'user__username')
    readonly_fields = ('created_at',)

    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }

    def ride_ref(self, obj):
        if obj.ride:
            return f"Ride #{obj.ride.id}"
        return "N/A"
    
    def emergency_flag(self, obj):
        # All incidents are critical in this dispatch system
        return format_html('<span style="color: white; background: #dc2626; padding: 2px 5px; border-radius: 3px; font-size: 10px;">HIGH PRIORITY</span>')
    emergency_flag.short_description = 'Alert Level'

@admin.register(FraudAlert)
class FraudAlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_link', 'reason', 'severity_badge', 'is_resolved', 'created_at')
    list_filter = ('severity', 'is_resolved', 'created_at')
    search_fields = ('user__username', 'reason', 'details')
    actions = ['mark_resolved']

    def user_link(self, obj):
        return format_html('<a href="../user/{}/change/">{}</a>', obj.user.id, obj.user.username)
    user_link.short_description = 'User'

    def severity_badge(self, obj):
        colors = {
            'low': '#facc15', # Yellow
            'medium': '#f97316', # Orange
            'critical': '#ef4444' # Red
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold; text-transform: uppercase;">{}</span>',
            colors.get(obj.severity, '#94a3b8'),
            obj.severity
        )
    severity_badge.short_description = 'Severity'

    @admin.action(description='Mark selected alerts as resolved')
    def mark_resolved(self, request, queryset):
        queryset.update(is_resolved=True)


@admin.register(LGURevenue, site=admin_site)
class LGURevenueAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride_link', 'amount_display', 'commission_rate', 'purpose_badge', 'collected_at')
    list_filter = ('purpose', 'collected_at')
    search_fields = ('ride__id', 'notes')
    readonly_fields = ('collected_at',)
    
    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }
    
    def ride_link(self, obj):
        return format_html('<a href="../ride/{}/change/">Ride #{}</a>', obj.ride.id, obj.ride.id)
    ride_link.short_description = 'Related Ride'
    
    def amount_display(self, obj):
        return format_html('<span style="font-weight: bold; color: #059669; font-size: 14px;">₱{:.2f}</span>', obj.amount)
    amount_display.short_description = 'LGU Commission'
    
    def purpose_badge(self, obj):
        colors = {
            'system_maintenance': '#3b82f6',  # Blue
            'emergency_fund': '#ef4444',      # Red
            'regulatory': '#8b5cf6',          # Purple
            'driver_benefits': '#10b981',     # Green
            'general': '#64748b',             # Gray
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase;">{}</span>',
            colors.get(obj.purpose, '#64748b'),
            obj.get_purpose_display()
        )
    purpose_badge.short_description = 'Purpose'


@admin.register(ActivityLog, site=admin_site)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_link', 'action', 'ip_address', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('user__username', 'action', 'details', 'ip_address')
    readonly_fields = ('created_at',)

    def user_link(self, obj):
        if not obj.user:
            return format_html('<i style="color: #64748b;">System</i>')
        return format_html('<a href="../user/{}/change/">{}</a>', obj.user.id, obj.user.username)
    user_link.short_description = 'User'


@admin.register(Withdrawal, site=admin_site)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ('id', 'driver_link', 'amount_display', 'method', 'account_number', 'account_name', 'status_badge', 'created_at')
    list_filter = ('status', 'method', 'created_at')
    search_fields = ('user__username', 'account_number', 'account_name', 'reference_id')
    readonly_fields = ('created_at', 'updated_at')
    actions = ['approve_withdrawals', 'reject_withdrawals']

    class Media:
        css = {
            'all': ('css/admin_custom.css',)
        }

    def driver_link(self, obj):
        return format_html('<a href="../user/{}/change/"><b>{}</b></a>', obj.user.id, obj.user.username)
    driver_link.short_description = 'Driver'

    def amount_display(self, obj):
        return format_html('<span style="font-weight: bold; color: #b91c1c;">₱{:.2f}</span>', obj.amount)
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        colors = {
            'pending': '#f59e0b',    # Orange
            'processing': '#3b82f6', # Blue
            'completed': '#10b981',  # Green
            'rejected': '#ef4444',   # Red
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase;">{}</span>',
            colors.get(obj.status, '#64748b'),
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    @admin.action(description='Approve and mark selected withdrawals as completed')
    def approve_withdrawals(self, request, queryset):
        # We update the status to completed
        updated = 0
        for withdrawal in queryset.filter(status__in=['pending', 'processing']):
            withdrawal.status = 'completed'
            withdrawal.save()
            updated += 1
        self.message_user(request, f"{updated} withdrawal requests were successfully approved.")

    @admin.action(description='Reject selected withdrawals')
    def reject_withdrawals(self, request, queryset):
        updated = 0
        for withdrawal in queryset.filter(status__in=['pending', 'processing']):
            # Refund the balance to user
            user = withdrawal.user
            user.wallet_balance += withdrawal.amount
            user.save()
            
            # Log refund transaction
            WalletTransaction.objects.create(
                user=user,
                amount=withdrawal.amount,
                transaction_type='refund',
                description=f"Refund from rejected withdrawal #{withdrawal.id}"
            )
            
            withdrawal.status = 'rejected'
            withdrawal.save()
            updated += 1
        self.message_user(request, f"{updated} withdrawal requests were rejected and refunded.")



