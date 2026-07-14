"""
report_views.py
─────────────────────────────────────────────────────────────────────────────
Admin-only endpoints for analytics exports and dashboard data.

Endpoints
---------
GET /api/reports/revenue/csv/      → Download LGU Revenue as CSV
GET /api/reports/revenue/pdf/      → Download LGU Revenue as branded PDF
GET /api/reports/heatmap/          → JSON heatmap data (lat/lng weight points)
GET /api/reports/dashboard-stats/  → KPI stats + charts for Admin Dashboard
"""

import csv
import io
from datetime import timedelta

from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncHour, TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission

from .models import Ride, User, FraudAlert, LGURevenue, Incident


# ─────────────────────────────────────────────────────────────────────────────
# Permission
# ─────────────────────────────────────────────────────────────────────────────

class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


# ─────────────────────────────────────────────────────────────────────────────
# 1. CSV Export
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminRole])
def export_revenue_csv(request):
    """Download a CSV of all completed rides with fare breakdown."""
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    rides = Ride.objects.filter(status='completed').order_by('-completed_at')
    if start_date:
        rides = rides.filter(completed_at__date__gte=start_date)
    if end_date:
        rides = rides.filter(completed_at__date__lte=end_date)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="TrentoSmart_LGU_Revenue.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Ride ID', 'Date Completed', 'Passenger', 'Driver',
        'Pickup', 'Destination',
        'Total Fare (PHP)', 'Driver Earnings (PHP)', 'LGU Commission (PHP)',
        'Status',
    ])

    total_fare = 0
    total_commission = 0
    total_earnings = 0

    for ride in rides:
        fare = float(ride.fare or 0)
        commission = float(ride.lgu_commission or 0)
        earnings = float(ride.driver_earnings or 0)
        total_fare += fare
        total_commission += commission
        total_earnings += earnings

        writer.writerow([
            ride.id,
            ride.completed_at.strftime('%Y-%m-%d %H:%M') if ride.completed_at else 'N/A',
            ride.passenger.username if ride.passenger else 'Unknown',
            ride.driver.username if ride.driver else 'Unknown',
            ride.pickup_address or '',
            ride.dest_address or '',
            f'{fare:.2f}',
            f'{earnings:.2f}',
            f'{commission:.2f}',
            ride.status,
        ])

    writer.writerow([])
    writer.writerow([
        'TOTALS', '', '', '', '', '',
        f'{total_fare:.2f}', f'{total_earnings:.2f}', f'{total_commission:.2f}', '',
    ])

    return response


# ─────────────────────────────────────────────────────────────────────────────
# 2. PDF Export
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminRole])
def export_revenue_pdf(request):
    """
    Generate and return a branded PDF report of LGU Revenue.
    Uses reportlab for pure-Python PDF generation (no external tools needed).
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    except ImportError:
        return Response(
            {'error': 'reportlab is not installed. Run: pip install reportlab'},
            status=500
        )

    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    rides = Ride.objects.filter(status='completed').order_by('-completed_at')
    if start_date:
        rides = rides.filter(completed_at__date__gte=start_date)
    if end_date:
        rides = rides.filter(completed_at__date__lte=end_date)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    brand_yellow = colors.HexColor('#FFD700')
    brand_dark = colors.HexColor('#0f172a')

    title_style = ParagraphStyle(
        'Title', parent=styles['Heading1'],
        fontSize=22, textColor=brand_dark, alignment=TA_CENTER,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'Sub', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER, spaceAfter=2,
    )
    right_style = ParagraphStyle(
        'Right', parent=styles['Normal'],
        fontSize=9, textColor=colors.HexColor('#64748b'),
        alignment=TA_RIGHT,
    )

    story = []

    # Header
    story.append(Paragraph("🚖 TrentoSmart", title_style))
    story.append(Paragraph("LGU Revenue Report", subtitle_style))
    period = f"Period: {start_date or 'All time'} to {end_date or 'present'}"
    story.append(Paragraph(period, subtitle_style))
    story.append(Paragraph(f"Generated: {timezone.now().strftime('%B %d, %Y %I:%M %p')}", right_style))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=brand_yellow))
    story.append(Spacer(1, 0.6 * cm))

    # Summary row
    agg = rides.aggregate(
        total_fare=Sum('fare'),
        total_commission=Sum('lgu_commission'),
        total_earnings=Sum('driver_earnings'),
        ride_count=Count('id'),
    )
    summary_data = [
        ['Total Rides', 'Gross Revenue', 'LGU Commission', 'Driver Earnings'],
        [
            str(agg['ride_count'] or 0),
            f"₱{float(agg['total_fare'] or 0):,.2f}",
            f"₱{float(agg['total_commission'] or 0):,.2f}",
            f"₱{float(agg['total_earnings'] or 0):,.2f}",
        ],
    ]
    summary_table = Table(summary_data, colWidths=[4 * cm, 4.5 * cm, 4.5 * cm, 4.5 * cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), brand_dark),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#fefce8')),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 12),
        ('TEXTCOLOR', (0, 1), (-1, 1), brand_dark),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [None, None]),
        ('BOX', (0, 0), (-1, -1), 1.5, brand_yellow),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.8 * cm))

    # Detail table
    headers = ['#', 'Date', 'Passenger', 'Driver', 'Fare', 'Commission', 'Net']
    table_data = [headers]

    for idx, ride in enumerate(rides[:200], 1):  # Cap at 200 rows for reasonable PDF size
        table_data.append([
            str(idx),
            ride.completed_at.strftime('%m/%d %H:%M') if ride.completed_at else '—',
            (ride.passenger.username if ride.passenger else '—')[:16],
            (ride.driver.username if ride.driver else '—')[:16],
            f"₱{float(ride.fare or 0):,.0f}",
            f"₱{float(ride.lgu_commission or 0):,.0f}",
            f"₱{float(ride.driver_earnings or 0):,.0f}",
        ])

    col_widths = [1 * cm, 2.8 * cm, 3.2 * cm, 3.2 * cm, 2.3 * cm, 2.8 * cm, 2.2 * cm]
    detail_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    row_colors = [colors.HexColor('#f8fafc'), colors.white]
    detail_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), brand_dark),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), row_colors),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TEXTCOLOR', (4, 1), (4, -1), brand_dark),
        ('TEXTCOLOR', (5, 1), (5, -1), colors.HexColor('#0f766e')),  # commission: teal
        ('FONTNAME', (6, 1), (6, -1), 'Helvetica-Bold'),
    ]))
    story.append(detail_table)

    doc.build(story)
    buffer.seek(0)

    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="TrentoSmart_LGU_Revenue.pdf"'
    return response


# ─────────────────────────────────────────────────────────────────────────────
# 3. Heatmap Data (for Leaflet.heat)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminRole])
def get_heatmap_data(request):
    """
    Returns weighted lat/lng points for Leaflet.heat heatmap overlay.
    Each point = [lat, lng, intensity]
    Intensity is the number of rides requested from that location bucket.
    """
    days = int(request.GET.get('days', 30))
    since = timezone.now() - timedelta(days=days)

    rides = Ride.objects.filter(
        requested_at__gte=since,
        pickup_lat__isnull=False,
        pickup_lng__isnull=False,
    ).values('pickup_lat', 'pickup_lng')

    # Aggregate into buckets (3 decimal places ≈ 110 m resolution)
    bucket_map = {}
    for r in rides:
        key = (round(float(r['pickup_lat']), 3), round(float(r['pickup_lng']), 3))
        bucket_map[key] = bucket_map.get(key, 0) + 1

    # Normalize intensity to 0–1
    max_count = max(bucket_map.values(), default=1)
    points = [
        [lat, lng, count / max_count]
        for (lat, lng), count in bucket_map.items()
    ]

    return Response({'points': points, 'total_rides': len(rides), 'days': days})


# ─────────────────────────────────────────────────────────────────────────────
# 4. Admin Dashboard Stats (KPIs + Charts)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminRole])
def get_admin_dashboard_stats(request):
    """
    Returns real-time KPIs and chart data for the Admin Dashboard.
    All heavy aggregation is done at DB level.
    """
    now = timezone.now()

    # Auto-cleanup: mark drivers (2 mins) and passengers (5 mins) offline if no heartbeat ping
    stale_driver_cutoff = now - timedelta(minutes=2)
    User.objects.filter(
        role='driver', is_online=True,
        last_location_update__lt=stale_driver_cutoff
    ).update(is_online=False)

    stale_passenger_cutoff = now - timedelta(minutes=5)
    User.objects.filter(
        role='passenger', is_online=True,
        last_location_update__lt=stale_passenger_cutoff
    ).update(is_online=False)

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    # ── KPI Stats ────────────────────────────────────────────────────────
    stats = {
        'drivers': User.objects.filter(role='driver', is_active=True).count(),
        'onlineDrivers': User.objects.filter(role='driver', is_online=True, is_active=True).count(),
        'onlinePassengers': User.objects.filter(role='passenger', is_online=True, is_active=True).count(),
        'activeRides': Ride.objects.filter(status__in=['requested', 'accepted', 'on_route']).count(),
        'totalRidesToday': Ride.objects.filter(requested_at__gte=today_start).count(),
        'completedToday': Ride.objects.filter(status='completed', completed_at__gte=today_start).count(),
        'cancelledToday': Ride.objects.filter(status='cancelled', requested_at__gte=today_start).count(),
        # ✅ FIX: Use actual SOS Incident model (not FraudAlert) so Safety Hub badge shows correct count
        'incidents': Incident.objects.filter(status__in=['pending', 'active']).count(),
        'criticalAlerts': FraudAlert.objects.filter(is_resolved=False, severity='critical').count(),
        'fraudAlerts': FraudAlert.objects.filter(is_resolved=False).count(),
        'totalRevenue': float(
            Ride.objects.filter(status='completed')
            .aggregate(total=Sum('fare'))['total'] or 0
        ),
        'commission': float(
            Ride.objects.filter(status='completed')
            .aggregate(total=Sum('lgu_commission'))['total'] or 0
        ),
        'revenueToday': float(
            Ride.objects.filter(status='completed', completed_at__gte=today_start)
            .aggregate(total=Sum('fare'))['total'] or 0
        ),
    }

    # ── Hourly Ride Chart (last 24 h) ─────────────────────────────────────
    hourly_rides = (
        Ride.objects.filter(requested_at__gte=last_24h)
        .annotate(hour=TruncHour('requested_at'))
        .values('hour')
        .annotate(rides=Count('id'))
        .order_by('hour')
    )
    hour_map = {entry['hour']: entry['rides'] for entry in hourly_rides}
    current_hour = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
    chart_data = []
    for _ in range(24):
        chart_data.append({
            'name': current_hour.strftime('%I %p'),
            'rides': hour_map.get(current_hour, 0),
        })
        current_hour += timedelta(hours=1)

    # ── Daily Revenue Chart (last 7 days) ─────────────────────────────────
    daily_revenue = (
        Ride.objects.filter(status='completed', completed_at__gte=last_7d)
        .annotate(day=TruncDate('completed_at'))
        .values('day')
        .annotate(revenue=Sum('fare'), commission=Sum('lgu_commission'))
        .order_by('day')
    )
    daily_data = [
        {
            'day': entry['day'].strftime('%a'),
            'revenue': float(entry['revenue'] or 0),
            'commission': float(entry['commission'] or 0),
        }
        for entry in daily_revenue
    ]

    # ── LGU Revenue Breakdown by Purpose ──────────────────────────────────
    revenue_breakdown = (
        LGURevenue.objects.values('purpose')
        .annotate(total=Sum('amount'))
        .order_by('-total')
    )
    revenue_data = [
        {'name': rb['purpose'].replace('_', ' ').title(), 'value': float(rb['total'] or 0)}
        for rb in revenue_breakdown
    ]

    return Response({
        'stats': stats,
        'chartData': chart_data,
        'dailyData': daily_data,
        'revenueData': revenue_data,
    })
