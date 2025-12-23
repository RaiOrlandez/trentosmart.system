#!/usr/bin/env python
"""
Seed demo users and sample rides for the Trike system.
Run after migrations:

    python seed_demo.py

This script is idempotent: it will not create duplicates if run multiple times.
"""
import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trike_server.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import Ride, SystemConfig
from django.utils import timezone

User = get_user_model()

def create_user(username, email, password, role='passenger', verified=False, phone='', emergency=''):
    u, created = User.objects.get_or_create(username=username, defaults={'email': email, 'role': role})
    u.phone_number = phone
    u.emergency_contact_phone = emergency
    if created:
        u.set_password(password)
        u.is_verified_driver = verified
        print(f'Created user: {username} ({role})')
    else:
        print(f'Updated user: {username} ({role})')
    u.save()
    return u

def create_ride(passenger, pickup_address, dest_address, pickup_lat, pickup_lng, dest_lat, dest_lng, fare=None, status='requested'):
    # Avoid creating duplicate rides with same passenger and pickup/dest addresses and timestamps
    qs = Ride.objects.filter(passenger=passenger, pickup_address=pickup_address, dest_address=dest_address)
    if qs.exists():
        print('Ride already exists:', pickup_address, '->', dest_address)
        return qs.first()
    ride = Ride.objects.create(
        passenger=passenger,
        pickup_address=pickup_address,
        dest_address=dest_address,
        pickup_lat=Decimal(str(pickup_lat)),
        pickup_lng=Decimal(str(pickup_lng)),
        dest_lat=Decimal(str(dest_lat)),
        dest_lng=Decimal(str(dest_lng)),
        fare=Decimal(str(fare)) if fare is not None else None,
        status=status,
        requested_at=timezone.now(),
    )
    print('Created ride id=', ride.id)
    return ride

def main():
    admin = create_user('admin', 'admin@example.com', 'demo', role='admin')
    passenger = create_user('passenger', 'passenger@example.com', 'demo', role='passenger', phone='+639123456789', emergency='+639987654321')
    driver = create_user('driver', 'driver@example.com', 'demo', role='driver', verified=True, phone='+639456123789')

    # Sample rides near Trento, Agusan del Sur (approx coords)
    create_ride(passenger, 'Brgy. Poblacion', 'Brgy. East', 8.314000, 125.899000, 8.320000, 125.905000, fare=50.00)
    create_ride(passenger, 'Market Area', 'Municipal Hall', 8.315500, 125.900500, 8.318000, 125.905500, fare=40.00)

    # Seeding System Configuration
    SystemConfig.objects.get_or_create(key='base_fare', defaults={'value': '30.00', 'description': 'Initial fare for first 2km'})
    SystemConfig.objects.get_or_create(key='rate_per_km', defaults={'value': '8.00', 'description': 'Additional fare per kilometer'})
    SystemConfig.objects.get_or_create(key='surge_threshold', defaults={'value': '1.5', 'description': 'Ratio of riders/drivers to trigger surge'})

    print('Seeding complete.')

if __name__ == '__main__':
    main()
