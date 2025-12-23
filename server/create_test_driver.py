"""
Quick script to create a test driver account for the Trento Smart system.
Run this from the server directory: python create_test_driver.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trike_server.settings')
django.setup()

from api.models import User

def create_test_driver():
    """Create a test driver account if it doesn't exist."""
    
    username = 'testdriver'
    
    # Check if driver already exists
    if User.objects.filter(username=username).exists():
        print(f"✓ Driver '{username}' already exists!")
        driver = User.objects.get(username=username)
        
        # Ensure it's verified
        if not driver.is_verified_driver:
            driver.is_verified_driver = True
            driver.save()
            print(f"✓ Verified driver '{username}'")
        
        print(f"\nDriver Details:")
        print(f"  Username: {driver.username}")
        print(f"  Email: {driver.email}")
        print(f"  Role: {driver.role}")
        print(f"  Verified: {driver.is_verified_driver}")
        print(f"  Vehicle: {driver.vehicle_model or 'Not set'}")
        
        return driver
    
    # Create new driver
    try:
        driver = User.objects.create_user(
            username=username,
            email='testdriver@trento.com',
            password='testpass123',
            role='driver',
            is_verified_driver=True,
            phone_number='09123456789',
            vehicle_model='Standard Tricycle',
            vehicle_color='Blue',
            vehicle_plate='TRT-001',
            sidecar_type='Roofed',
            address='Trento, Agusan del Sur',
            first_name='Test',
            last_name='Driver'
        )
        
        print(f"✓ Successfully created test driver!")
        print(f"\nDriver Details:")
        print(f"  Username: {driver.username}")
        print(f"  Password: testpass123")
        print(f"  Email: {driver.email}")
        print(f"  Role: {driver.role}")
        print(f"  Verified: {driver.is_verified_driver}")
        print(f"  Vehicle: {driver.vehicle_model}")
        print(f"  Plate: {driver.vehicle_plate}")
        
        print(f"\n✓ You can now request rides as a passenger!")
        print(f"✓ This driver will be auto-assigned to your rides.")
        
        return driver
        
    except Exception as e:
        print(f"✗ Error creating driver: {e}")
        return None

def list_all_drivers():
    """List all drivers in the system."""
    drivers = User.objects.filter(role='driver')
    
    print(f"\n{'='*50}")
    print(f"Total Drivers in System: {drivers.count()}")
    print(f"{'='*50}")
    
    if drivers.count() == 0:
        print("No drivers found.")
    else:
        for i, driver in enumerate(drivers, 1):
            print(f"\n{i}. {driver.username}")
            print(f"   Email: {driver.email}")
            print(f"   Verified: {'✓' if driver.is_verified_driver else '✗'}")
            print(f"   Vehicle: {driver.vehicle_model or 'Not set'}")
            print(f"   Plate: {driver.vehicle_plate or 'Not set'}")

if __name__ == '__main__':
    print("="*50)
    print("Trento Smart - Test Driver Creator")
    print("="*50)
    
    create_test_driver()
    list_all_drivers()
    
    print(f"\n{'='*50}")
    print("Done! The system is ready for testing.")
    print("="*50)
