import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trike_server.settings')
django.setup()

from api.models import User

def verify_existing_users():
    updated = User.objects.filter(is_email_verified=False).update(is_email_verified=True)
    print(f"Successfully verified {updated} existing users.")

if __name__ == "__main__":
    verify_existing_users()
