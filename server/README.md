# Trike Server (Django REST)

This is a minimal Django REST backend scaffold for the Trento Smart Tricycle Dispatch System.

Quick start

1. Create a virtual environment and install requirements:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Configure environment variables (create a `.env` file):

```
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=1
MYSQL_DATABASE=transport
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

3. Apply migrations and create superuser:

```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API endpoints (examples)

- POST `/api/auth/register/` -> register user
- POST `/api/auth/login/` -> obtain JWT tokens
- GET/POST `/api/rides/` -> create and list rides
- GET `/api/driver/requests/` -> pending requests for drivers
- POST `/api/driver/accept/<id>/` -> driver accepts ride

Notes
- The project uses a custom `User` model (`api.User`) with a `role` field (passenger/driver/admin).
- Fare calculation and automated dispatching should be implemented server-side. Use location math (Haversine) to find nearest drivers.
- For real-time position updates, integrate Channels/Socket.IO or a lightweight websocket service and broadcast driver locations to passengers.
