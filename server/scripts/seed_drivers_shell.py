from django.utils import timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
User = get_user_model()

drivers_data = [
    {
        'username': 'juan_tricycle',
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
        'last_lng': 126.0625
    },
    {
        'username': 'maria_wheels',
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
        'last_lng': 126.0618
    },
    {
        'username': 'pedro_trike',
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
        'last_lng': 126.0635
    }
]

for data in drivers_data:
    user, created = User.objects.update_or_create(
        username=data['username'],
        defaults={
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
            'last_location_update': timezone.now()
        }
    )
    if created:
        user.set_password('driver123')
        user.save()
        print(f"Created driver: {user.username}")
    else:
        print(f"Updated driver: {user.username}")
