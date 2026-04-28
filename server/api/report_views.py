import csv
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from .models import Ride

@api_view(['GET'])
@permission_classes([IsAdminUser])
def export_revenue_csv(request):
    """
    Generates a CSV report of revenue, commissions, and ride details for LGU paper trails.
    Can be filtered by date, but defaults to all completed rides.
    """
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
