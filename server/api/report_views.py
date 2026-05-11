import csv
from django.http import HttpResponse
from django.db.models import Sum, Count
from django.db.models.functions import TruncHour
from django.utils import timezone
from datetime import timedelta
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from .models import Ride, User, FraudAlert

@api_view(['GET'])
@permission_classes([IsAdminUser])
def export_revenue_csv(request):
    # ... (existing code)
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="LGU_Revenue_Report.csv"'

    writer = csv.writer(response)
    # Write the header row
    writer.writerow([
        'Ride ID', 
        'Date Completed', 
        'Passenger', 
        'Driver', 
        'Total Fare (PHP)', 
        'Driver Earnings (PHP)', 
        'LGU Commission (PHP)',
        'Status'
    ])

    # Fetch completed rides (you can add ?start_date=xxx filters here)
    rides = Ride.objects.filter(status='completed').order_by('-completed_at')

    total_fare = 0
    total_commission = 0

    for ride in rides:
        writer.writerow([
            ride.id,
            ride.completed_at.strftime('%Y-%m-%d %H:%M:%S') if ride.completed_at else 'N/A',
            ride.passenger.username if ride.passenger else 'Unknown',
            ride.driver.username if ride.driver else 'Unknown',
            ride.fare if ride.fare else 0,
            ride.driver_earnings if ride.driver_earnings else 0,
            ride.lgu_commission if ride.lgu_commission else 0,
            ride.status
        ])
        if ride.fare: total_fare += ride.fare
        if ride.lgu_commission: total_commission += ride.lgu_commission

    # Add a summary row at the bottom
    writer.writerow([])
    writer.writerow(['TOTAL', '', '', '', total_fare, '', total_commission, ''])

    return response

@api_view(['GET'])
@permission_classes([IsAdminUser])
def get_admin_dashboard_stats(request):
    """
    Returns real-time KPIs and chart data for the Admin Dashboard.
    Optimized to do heavy lifting on DB instead of client.
    """
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # KPI Stats
    stats = {
        'drivers': User.objects.filter(role='driver').count(),
        'onlineDrivers': User.objects.filter(role='driver', is_online=True).count(),
        'onlinePassengers': User.objects.filter(role='passenger', is_online=True).count(),
        'activeRides': Ride.objects.filter(status__in=['requested', 'accepted', 'on_route']).count(),
        'totalRidesToday': Ride.objects.filter(requested_at__gte=today_start).count(),
        'incidents': FraudAlert.objects.filter(is_resolved=False).count(),
        'totalRevenue': float(Ride.objects.filter(status='completed').aggregate(total=Sum('fare'))['total'] or 0),
        'commission': float(Ride.objects.filter(status='completed').aggregate(total=Sum('lgu_commission'))['total'] or 0),
    }

    # Chart Data (Last 24 Hours by Hour)
    last_24h = now - timedelta(hours=24)
    hourly_rides = Ride.objects.filter(requested_at__gte=last_24h)\
        .annotate(hour=TruncHour('requested_at'))\
        .values('hour')\
        .annotate(rides=Count('id'))\
        .order_by('hour')

    chart_data = []
    hour_map = {entry['hour']: entry['rides'] for entry in hourly_rides}
    
    # Generate continuous sequence for all 24 hours
    current_hour = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
    for _ in range(24):
        chart_data.append({
            'name': current_hour.strftime('%I %p'),
            'rides': hour_map.get(current_hour, 0)
        })
        current_hour += timedelta(hours=1)

    return Response({
        'stats': stats,
        'chartData': chart_data
    })
