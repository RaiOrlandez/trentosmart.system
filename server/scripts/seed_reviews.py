from django.utils import timezone
from api.models import Ride, Review
from django.contrib.auth import get_user_model
import random

User = get_user_model()
drivers = User.objects.filter(username__in=['juan_tricycle', 'maria_wheels', 'pedro_trike'])
passenger = User.objects.filter(role='passenger').first()

if not passenger:
    passenger = User.objects.create_user(username='demo_passenger', password='password123', role='passenger')

comments = ['Reliable driver', 'Very helpful', 'Smooth ride', 'Courteous', 'Safe driving']

for d in drivers:
    # Clear existing reviews for clean demo if desired, or just add
    d.received_reviews.all().delete()
    for _ in range(5):
        ride = Ride.objects.create(
            passenger=passenger, 
            driver=d, 
            status='completed', 
            fare=random.randint(40, 100),
            pickup_address='Trento Plaza',
            dest_address='Trento Market'
        )
        Review.objects.create(
            ride=ride, 
            reviewer=passenger, 
            reviewee=d, 
            rating=random.randint(4, 5), 
            comment=random.choice(comments)
        )
    print(f'Populated 5 reviews for {d.username}. Current Avg: {d.average_rating}')
