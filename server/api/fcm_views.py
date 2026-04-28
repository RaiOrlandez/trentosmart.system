from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_fcm_token(request):
    token = request.data.get('token')
    if token:
        request.user.fcm_device_token = token
        request.user.save()
        return Response({"message": "Token saved successfully"})
    return Response({"error": "Token is required"}, status=400)
