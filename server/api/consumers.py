import json
import math
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
import urllib.parse


# ──────────────────────────────────────────────────────
# Utility: Haversine distance (km) used for dispatch
# ──────────────────────────────────────────────────────
def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class RideConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.ride_group_name = f'ride_{self.ride_id}'

        query_string = self.scope.get('query_string', b'').decode()
        params = urllib.parse.parse_qs(query_string)

        is_guest = params.get('guest', ['false'])[0] == 'true'
        jwt_token = params.get('token', [None])[0]

        if is_guest and jwt_token:
            # ── Guest / public tracker: validate share token ────────────────
            valid = await self.validate_share_token(self.ride_id, jwt_token)
            if not valid:
                await self.close(code=4001)
                return
            self.scope['is_guest'] = True
        else:
            # ── Authenticated user: validate JWT from query string ──────────
            # AuthMiddlewareStack only supports session/cookie auth, not JWT.
            # We must parse the Bearer token manually from the query string.
            user = self.scope.get('user')
            if not user or not user.is_authenticated:
                # Try to resolve the user from the JWT query-param token
                if jwt_token:
                    user = await self.get_user_from_token(jwt_token)
                    if user:
                        self.scope['user'] = user  # Store for receive() usage

            if not user or not user.is_authenticated:
                print(f"[RideConsumer] Rejected unauthenticated connection for ride {self.ride_id}")
                await self.close(code=4003)
                return

            self.scope['is_guest'] = False

        await self.channel_layer.group_add(self.ride_group_name, self.channel_name)
        await self.accept()
        print(f"[RideConsumer] Connected: ride={self.ride_id} group={self.ride_group_name}")

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        """Resolve a Django User from a JWT access token string."""
        try:
            access_token = AccessToken(token_key)
            User = get_user_model()
            return User.objects.get(id=access_token['user_id'])
        except Exception as e:
            print(f"[RideConsumer] JWT auth failed: {e}")
            return None

    @database_sync_to_async
    def validate_share_token(self, ride_id, token):
        from .models import Ride
        try:
            return Ride.objects.filter(id=ride_id, share_token=token).exists()
        except Exception:
            return False

    async def disconnect(self, close_code):
        if hasattr(self, 'ride_group_name'):
            await self.channel_layer.group_discard(self.ride_group_name, self.channel_name)
            print(f"[RideConsumer] Disconnected: ride={self.ride_id} code={close_code}")

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        # Guests may only receive — never send
        is_guest = self.scope.get('is_guest', False)
        if is_guest:
            return

        # Extra guard: ensure user is still authenticated
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return

        if message_type == 'chat':
            await self.channel_layer.group_send(
                self.ride_group_name,
                {
                    'type': 'chat_message',
                    'message': data.get('message', ''),
                    'sender': data.get('sender', user.username),
                    'msg_type': data.get('msg_type', 'text'),
                }
            )
        elif message_type == 'location':
            await self.channel_layer.group_send(
                self.ride_group_name,
                {
                    'type': 'location_update',
                    'lat': data.get('lat'),
                    'lng': data.get('lng'),
                    'heading': data.get('heading'),
                    'accuracy': data.get('accuracy'),
                    'status': data.get('status'),
                    'sender': user.username,
                    'sender_role': user.role,
                }
            )
        else:
            # Forward any other typed event to the group
            await self.channel_layer.group_send(
                self.ride_group_name,
                {
                    'type': 'location_update',
                    'lat': data.get('lat'),
                    'lng': data.get('lng'),
                    'heading': data.get('heading'),
                    'accuracy': data.get('accuracy'),
                    'status': data.get('status'),
                }
            )

    async def location_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'location',
            'lat': event.get('lat'),
            'lng': event.get('lng'),
            'heading': event.get('heading'),
            'accuracy': event.get('accuracy'),
            'status': event.get('status'),
            'sender': event.get('sender', ''),
            'sender_role': event.get('sender_role', ''),
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat',
            'message': event.get('message', ''),
            'sender': event.get('sender', ''),
            'msg_type': event.get('msg_type', 'text'),
        }))

    async def ride_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'status': event.get('status'),
            'data': event.get('data'),
        }))


class AdminConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'admin_alerts'

        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            try:
                query_string = self.scope.get('query_string', b'').decode()
                params = urllib.parse.parse_qs(query_string)
                if 'token' in params:
                    user = await self.get_user_from_token(params['token'][0])
                    self.scope['user'] = user
            except Exception as e:
                print(f"Admin WebSocket Auth Error: {e}")

        if not user or not user.is_authenticated or user.role != 'admin':
            print("Rejected non-admin connection to AdminConsumer.")
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        try:
            access_token = AccessToken(token_key)
            User = get_user_model()
            return User.objects.get(id=access_token['user_id'])
        except Exception:
            return None

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def emergency_alert(self, event):
        await self.send(text_data=json.dumps(event))


class SystemConsumer(AsyncWebsocketConsumer):
    """
    Handles global system events:
      • New ride requests  ➜ smart-dispatched to nearby online drivers
      • Driver location updates broadcast to admin/passenger
      • New user sign-ups
      • Emergency alerts
    """

    async def connect(self):
        self.group_name = 'global_system'
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Authenticate via JWT query parameter if middleware didn't resolve it
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            try:
                query_string = self.scope['query_string'].decode()
                params = urllib.parse.parse_qs(query_string)
                if 'token' in params:
                    user = await self.get_user_from_token(params['token'][0])
                    self.scope['user'] = user
            except Exception as e:
                print(f"SystemConsumer Auth Error: {e}")

        # Register personal group for targeted dispatch (drivers & passengers)
        self.user_group_name = None
        if user and user.is_authenticated:
            self.user_group_name = f'user_{user.id}'
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)
            print(f"[SystemConsumer] User {user.username} connected → {self.user_group_name}")

        await self.accept()

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        try:
            access_token = AccessToken(token_key)
            User = get_user_model()
            return User.objects.get(id=access_token['user_id'])
        except Exception:
            return None

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if self.user_group_name:
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)

    # ── Inbound message from client ──────────────────────────────────────
    async def receive(self, text_data):
        """
        Handles messages sent from the connected client.
        Currently used by the admin dashboard to request a manual dispatch.
        """
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')
        user = self.scope.get('user')

        if msg_type == 'manual_dispatch' and user and getattr(user, 'role', '') == 'admin':
            # Admin manually triggers dispatch for a specific ride
            ride_id = data.get('ride_id')
            if ride_id:
                await self.smart_dispatch_ride(ride_id)

    # ── Smart Dispatch ───────────────────────────────────────────────────
    async def smart_dispatch_ride(self, ride_id):
        """
        Core dispatch algorithm:
          1. Load the ride and its pick-up coordinates.
          2. Find ALL online, verified, available drivers.
          3. Filter by search_radius_km.
          4. Sort by distance (nearest first).
          5. Broadcast the ride request to each qualifying driver's personal group.

        This is O(n) in the number of online drivers — acceptable for a
        city-scale deployment like Trento.
        """
        ride_data, nearby_drivers = await self._get_ride_and_nearby_drivers(ride_id)

        if not ride_data:
            return

        pickup_lat = ride_data['pickup_lat']
        pickup_lng = ride_data['pickup_lng']
        radius_km = ride_data['search_radius_km']

        # Filter & sort by distance
        candidates = []
        for driver in nearby_drivers:
            if not driver['last_lat'] or not driver['last_lng']:
                continue
            dist = _haversine(
                pickup_lat, pickup_lng,
                float(driver['last_lat']), float(driver['last_lng'])
            )
            if dist <= radius_km:
                candidates.append({**driver, 'distance_km': round(dist, 2)})

        candidates.sort(key=lambda d: d['distance_km'])

        print(f"[Dispatch] Ride #{ride_id}: {len(candidates)} drivers within {radius_km} km")

        # Push to each candidate driver's personal channel group
        for driver in candidates:
            await self.channel_layer.group_send(
                f"user_{driver['id']}",
                {
                    'type': 'new_ride_request',
                    'ride': {
                        **ride_data,
                        'driver_distance_km': driver['distance_km'],
                    },
                }
            )

    @database_sync_to_async
    def _get_ride_and_nearby_drivers(self, ride_id):
        """
        DB layer: fetch the ride + all eligible online drivers.
        Returns (ride_dict, driver_list) or (None, []) on error.
        """
        from .models import Ride
        User = get_user_model()

        try:
            ride = Ride.objects.select_related('passenger').get(id=ride_id, status='requested')
        except Ride.DoesNotExist:
            return None, []

        # Basic validation: we need coordinates
        if not ride.pickup_lat or not ride.pickup_lng:
            return None, []

        ride_data = {
            'id': ride.id,
            'pickup_lat': float(ride.pickup_lat),
            'pickup_lng': float(ride.pickup_lng),
            'pickup_address': ride.pickup_address or '',
            'dest_address': ride.dest_address or '',
            'fare': float(ride.fare or 0),
            'passenger_name': ride.passenger.username if ride.passenger else 'Unknown',
            'search_radius_km': float(ride.search_radius_km) if hasattr(ride, 'search_radius_km') and ride.search_radius_km else 3.0,
        }

        # Auto-cleanup: mark drivers offline if no location ping in last 2 minutes
        from django.utils import timezone
        stale_cutoff = timezone.now() - timezone.timedelta(minutes=2)
        User.objects.filter(
            role='driver', is_online=True,
            last_location_update__lt=stale_cutoff
        ).update(is_online=False)

        # Fetch online, verified, active, not currently on a ride
        drivers = User.objects.filter(
            role='driver',
            is_online=True,
            is_verified_driver=True,
            is_active=True,
        ).exclude(
            # Exclude drivers already assigned to an active ride
            assigned_rides__status__in=['accepted', 'on_route']
        ).values('id', 'username', 'last_lat', 'last_lng')

        return ride_data, list(drivers)

    # ── Outbound event handlers (called by group_send) ───────────────────
    async def new_ride_request(self, event):
        await self.send(text_data=json.dumps(
            {'type': 'new_ride', 'ride': event['ride']}
        ))

    async def driver_location_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'driver_location',
            'driver_id': event['driver_id'],
            'username': event['username'],
            'lat': event['lat'],
            'lng': event['lng'],
            'heading': event.get('heading'),
            'accuracy': event.get('accuracy'),
            'status': event['status'],
            'is_online': event.get('is_online', True),
        }))

    async def new_user_signup(self, event):
        await self.send(text_data=json.dumps(
            {'type': 'new_signup', 'user': event['user']}
        ))

    async def system_emergency_alert(self, event):
        # CRITICAL FIX: 'event' contains 'type': 'system_emergency_alert' (the
        # Django Channels routing key). If we spread **event after our explicit
        # 'type': 'emergency_alert', Python overwrites it — so the frontend
        # would never see 'emergency_alert' and the red SOS banner would never
        # fire via WebSocket. We explicitly exclude the routing key here.
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(
            {'type': 'emergency_alert', **payload}
        ))

    async def system_event(self, event):
        await self.send(text_data=json.dumps(
            {'type': 'system_event', **event['event']}
        ))
