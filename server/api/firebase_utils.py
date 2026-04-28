import firebase_admin
from firebase_admin import credentials, messaging
import os

# Initialize Firebase App
cred_path = os.path.join(os.path.dirname(__file__), '../../firebase-key.json')
# For safety, we only initialize if the credential file exists
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
else:
    print("WARNING: firebase-key.json not found! Push notifications will fail.")

def send_push_notification(user, title, body, data=None):
    """
    Sends a push notification to a specific user.
    """
    if not hasattr(user, 'fcm_device_token') or not user.fcm_device_token:
        return False # User hasn't registered a device
    
    if not firebase_admin._apps:
        return False # Firebase not initialized
    
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=user.fcm_device_token,
    )
    
    try:
        response = messaging.send(message)
        print('Successfully sent push message:', response)
        return True
    except Exception as e:
        print('Error sending push message:', str(e))
        return False
