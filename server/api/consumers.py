import json
from channels.generic.websocket import AsyncWebsocketConsumer

class RideConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.ride_group_name = f'ride_{self.ride_id}'

        await self.channel_layer.group_add(
            self.ride_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.ride_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

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
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

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
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

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
            'status': event['status']
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
