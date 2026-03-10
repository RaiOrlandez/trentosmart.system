import os
import django
import sys
from decimal import Decimal
from django.utils import timezone

# Set up Django environment
sys.path.append('C:\\Users\\dell3\\Transmart\\server')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

def seed_mock_drivers():
    drivers_data = [
        {
            'username': 'juan_tricycle',
            'email': 'juan@example.com',
            'first_name': 'Juan',
            'last_name': 'Dela Cruz',
            'role': 'driver',
            'is_verified_driver': True,
            'phone_number': '09123456789',
            'vehicle_model': 'Kawasaki Barako',
            'vehicle_plate': 'TR-1234',
            'vehicle_color': 'Blue',
            'body_number': '7788',
            'sidecar_type': 'Roofed Standard',
            'last_lat': 8.0505,
            'last_lng': 126.0625,
            'last_location_update': timezone.now()
        },
        {
            'username': 'maria_wheels',
            'email': 'maria@example.com',
            'first_name': 'Maria',
            'last_name': 'Santos',
            'role': 'driver',
            'is_verified_driver': True,
            'phone_number': '09987654321',
            'vehicle_model': 'Honda TMX',
            'vehicle_plate': 'MT-5678',
            'vehicle_color': 'Red',
            'body_number': '4455',
            'sidecar_type': 'Semi-Roofed',
            'last_lat': 8.0498,
            'last_lng': 126.0618,
            'last_location_update': timezone.now()
        },
        {
            'username': 'pedro_trike',
            'email': 'pedro@example.com',
            'first_name': 'Pedro',
            'last_name': 'Penduko',
            'role': 'driver',
            'is_verified_driver': True,
            'phone_number': '09192837465',
            'vehicle_model': 'Suzuki GD110',
            'vehicle_plate': 'PT-9900',
            'vehicle_color': 'Black',
            'body_number': '1122',
            'sidecar_type': 'Open Standard',
            'last_lat': 8.0512,
            'last_lng': 126.0635,
            'last_location_update': timezone.now()
        }
    ]

    for data in drivers_data:
        user, created = User.objects.update_or_create(
            username=data['username'],
            defaults={
                'email': data['email'],
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'role': data['role'],
                'is_verified_driver': data['is_verified_driver'],
                'phone_number': data['phone_number'],
                'vehicle_model': data['vehicle_model'],
                'vehicle_plate': data['vehicle_plate'],
                'vehicle_color': data['vehicle_color'],
                'body_number': data['body_number'],
                'sidecar_type': data['sidecar_type'],
                'last_lat': Decimal(str(data['last_lat'])),
                'last_lng': Decimal(str(data['last_lng'])),
                'last_location_update': data['last_location_update']
            }
        )
        if created:
            user.set_password('driver123')
            user.save()
            print(f"Created driver: {user.username}")
        else:
            print(f"Updated driver: {user.username}")

if __name__ == '__main__':
    seed_mock_drivers()
