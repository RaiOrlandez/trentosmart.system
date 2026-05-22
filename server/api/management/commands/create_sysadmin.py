from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates or updates the system admin (React /admin + Django /admin/)'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='admin', help='Admin username')
        parser.add_argument('--email', type=str, default='admin@transmart.com', help='Admin email')
        parser.add_argument('--password', type=str, default='admin123', help='Admin password')

    def handle(self, *args, **options):
        username = options['username'].strip()
        email = options['email'].strip().lower()
        password = options['password']

        user = User.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=email)
        ).first()

        if user:
            self.stdout.write(self.style.WARNING(
                f'Updating existing account "{user.username}" ({user.email}) → admin'
            ))
            user.username = username
            user.email = email
            user.set_password(password)
            user.role = 'admin'
            user.is_superuser = True
            user.is_staff = True
            user.is_active = True
            user.is_email_verified = True
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'Admin ready — username: {username}, email: {email}'
            ))
        else:
            User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role='admin',
                is_superuser=True,
                is_staff=True,
                is_active=True,
                is_email_verified=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f'Created admin — username: {username}, email: {email}'
            ))
