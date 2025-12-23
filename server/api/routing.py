from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/ride/(?P<ride_id>\w+)/$', consumers.RideConsumer.as_asgi()),
    re_path(r'ws/admin/$', consumers.AdminConsumer.as_asgi()),
    re_path(r'ws/system/$', consumers.SystemConsumer.as_asgi()),
]
