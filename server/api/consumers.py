import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
import urllib.parse


class RideConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.ride_group_name = f'ride_{self.ride_id}'
        
        # Public tracking check
        user = self.scope.get('user')
        query_string = self.scope.get('query_string', b'').decode()
        params = urllib.parse.parse_qs(query_string)
        
        is_guest = params.get('guest', ['false'])[0] == 'true'
        token = params.get('token', [None])[0]

        if is_guest and token:
            valid = await self.validate_share_token(self.ride_id, token)
            if not valid:
                await self.close()
                return
        elif not user or not user.is_authenticated:
            # Fallback for normal connections without token
            await self.close()
            return

        await self.channel_layer.group_add(
            self.ride_group_name,
            self.channel_name
        )
        await self.accept()

    @database_sync_to_async
    def validate_share_token(self, ride_id, token):
        from .models import Ride
        try:
            return Ride.objects.filter(id=ride_id, share_token=token).exists()
        except:
            return False

    async def disconnect(self, close_code):
        if hasattr(self, 'ride_group_name'):
            await self.channel_layer.group_discard(
                self.ride_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        user = self.scope.get('user')

        # Guests can only receive, not send location/chat (simple security)
        if not user or not user.is_authenticated:
            return

        if message_type == 'chat':
            await self.channel_layer.group_send(
                self.ride_group_name,
                {
                    'type': 'chat_message',
                    'message': data.get('message'),
                    'sender': data.get('sender')
                }
            )
        else:
            await self.channel_layer.group_send(
                self.ride_group_name,
                {
                    'type': 'location_update',
                    'lat': data.get('lat'),
                    'lng': data.get('lng'),
                    'status': data.get('status')
                }
            )


    async def location_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'location',
            'lat': event['lat'],
            'lng': event['lng'],
            'status': event.get('status')
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat',
            'message': event['message'],
            'sender': event['sender']
        }))

    async def ride_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'status': event['status'],
            'data': event.get('data')
        }))


class AdminConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'admin_alerts'
        
        # Authenticate via Token
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            try:
                query_string = self.scope.get('query_string', b'').decode()
                params = urllib.parse.parse_qs(query_string)
                if 'token' in params:
                    token = params['token'][0]
                    user = await self.get_user_from_token(token)
                    self.scope['user'] = user
            except Exception as e:
                print(f"Admin WebSocket Auth Error: {e}")

        # Verify authentication AND admin role
        if not user or not user.is_authenticated or user.role != 'admin':
            print("Rejected non-admin connection attempt to AdminConsumer.")
            await self.close()
            return

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        try:
            access_token = AccessToken(token_key)
            user_id = access_token['user_id']
            User = get_user_model()
            return User.objects.get(id=user_id)
        except Exception:
            return None

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def emergency_alert(self, event):
        await self.send(text_data=json.dumps(event))


class SystemConsumer(AsyncWebsocketConsumer):
    """Handles global updates like new ride requests and driver locations."""
    async def connect(self):
        self.group_name = 'global_system'
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Authenticate via Token
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            try:
                query_string = self.scope['query_string'].decode()
                params = urllib.parse.parse_qs(query_string)
                if 'token' in params:
                    token = params['token'][0]
                    user = await self.get_user_from_token(token)
                    self.scope['user'] = user
            except Exception as e:
                print(f"WebSocket Auth Error: {e}")

        # Add to personal user group for targeted dispatch
        if user and user.is_authenticated:
            self.user_group_name = f'user_{user.id}'
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)
            print(f"Driver connected to {self.user_group_name}")

        await self.accept()

    @database_sync_to_async
    def get_user_from_token(self, token_key):
        try:
            access_token = AccessToken(token_key)
            user_id = access_token['user_id']
            User = get_user_model()
            return User.objects.get(id=user_id)
        except Exception as e:
            return None

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        
        user = self.scope.get('user')
        if user and user.is_authenticated:
            await self.channel_layer.group_discard(f'user_{user.id}', self.channel_name)

    async def new_ride_request(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_ride',
            'ride': event['ride']
        }))

    async def driver_location_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'driver_location',
            'driver_id': event['driver_id'],
            'username': event['username'],
            'lat': event['lat'],
            'lng': event['lng'],
            'status': event['status'],
            'is_online': event.get('is_online', True)
        }))

    async def new_user_signup(self, event):
        await self.send(text_data=json.dumps({
            'type': 'new_signup',
            'user': event['user']
        }))

    async def system_emergency_alert(self, event):
        await self.send(text_data=json.dumps({
            'type': 'emergency_alert',
            **event
        }))

    async def system_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system_event',
            **event['event']
        }))
