from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a system admin account with role="admin"'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, default='admin@trentosmart.gov', help='Admin email address')
        parser.add_argument('--password', type=str, default='admin123', help='Admin password')

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        username = email.split('@')[0]

        try:
            user = User.objects.get(email=email)
            self.stdout.write(self.style.WARNING(f'User with email {email} already exists. Updating password and setting role to admin...'))
            user.set_password(password)
            user.role = 'admin'
            user.is_superuser = True
            user.is_staff = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Successfully updated admin account: {email}'))
        except User.DoesNotExist:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role='admin',
                is_superuser=True,
                is_staff=True,
                is_email_verified=True
            )
            self.stdout.write(self.style.SUCCESS(f'Successfully created new admin account: {email}'))
