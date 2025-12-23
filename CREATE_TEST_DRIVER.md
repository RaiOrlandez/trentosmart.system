# Quick Fix: Create a Test Driver Account

## Problem
You're getting "This ride does not have a driver assigned yet" because there are no driver accounts in your database.

## Solution: Create a Driver Account

### Option 1: Via Django Admin (Recommended)

1. **Access Django Admin**:
   ```
   http://localhost:8000/admin
   ```

2. **Login** with your admin credentials (or create superuser if needed):
   ```bash
   cd server
   python manage.py createsuperuser
   ```

3. **Create a Driver**:
   - Go to "Users" section
   - Click "Add User"
   - Fill in:
     - Username: `testdriver`
     - Password: `testpass123`
     - Role: **Driver**
     - Is verified driver: **✓ Check this**
   - Save

### Option 2: Via Registration Page

1. **Go to**: `http://localhost:3000/register`

2. **Register as Driver**:
   - Username: `testdriver`
   - Email: `driver@test.com`
   - Password: `testpass123`
   - Role: Select **Driver**
   - Fill other required fields

3. **Verify the Driver** (via Django Admin):
   - Login to admin panel
   - Find the driver user
   - Check "Is verified driver"
   - Save

### Option 3: Via Python Shell (Fastest)

```bash
cd server
python manage.py shell
```

Then run:
```python
from api.models import User

# Create a test driver
driver = User.objects.create_user(
    username='testdriver',
    email='driver@test.com',
    password='testpass123',
    role='driver',
    is_verified_driver=True,
    phone_number='09123456789',
    vehicle_model='Tricycle',
    vehicle_plate='ABC-123'
)

print(f"Driver created: {driver.username}")
exit()
```

## After Creating Driver

1. **Refresh your passenger app**
2. **Request a new ride**
3. **Driver will be auto-assigned**
4. **Complete the ride**
5. **Rate the driver** ✨

## Verify Driver Exists

To check if drivers exist in your database:

```bash
cd server
python manage.py shell
```

```python
from api.models import User

# Check all drivers
drivers = User.objects.filter(role='driver')
print(f"Total drivers: {drivers.count()}")

for driver in drivers:
    print(f"- {driver.username} (Verified: {driver.is_verified_driver})")

exit()
```

## What Changed in the Code

The passenger app now:
1. ✅ Checks if drivers exist before creating ride
2. ✅ Shows clear error if no drivers available
3. ✅ Assigns driver **immediately** (not in setTimeout)
4. ✅ Waits for assignment to complete before showing "matched"
5. ✅ Provides console logs for debugging

## Testing After Fix

1. Create at least one driver account (see above)
2. Login as passenger
3. Request a ride
4. You should see in console: `Driver assigned: testdriver`
5. Complete the ride
6. Rating modal appears
7. Submit review successfully! 🎉

## Still Having Issues?

Check the browser console (F12) for error messages. Common issues:

- **"No drivers available"**: Create a driver account
- **"Failed to assign driver"**: Check Django server logs
- **"Network Error"**: Ensure Django server is running on port 8000
- **"401 Unauthorized"**: Login again

## Need More Drivers?

You can create multiple drivers for testing:

```python
from api.models import User

drivers_data = [
    {'username': 'driver1', 'vehicle': 'Red Tricycle', 'plate': 'ABC-001'},
    {'username': 'driver2', 'vehicle': 'Blue Tricycle', 'plate': 'ABC-002'},
    {'username': 'driver3', 'vehicle': 'Green Tricycle', 'plate': 'ABC-003'},
]

for data in drivers_data:
    User.objects.create_user(
        username=data['username'],
        password='testpass123',
        role='driver',
        is_verified_driver=True,
        vehicle_model=data['vehicle'],
        vehicle_plate=data['plate']
    )
    print(f"Created: {data['username']}")
```

This will give you a pool of drivers for more realistic testing!
