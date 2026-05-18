import firebase_admin
from firebase_admin import credentials, messaging, auth as firebase_auth
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


def verify_google_token(id_token):
    """
    Verifies a Firebase ID token (from Google Sign-In on the frontend).
    Returns decoded token dict with uid, email, name, picture, etc.
    Raises ValueError on invalid/expired tokens.
    """
    if not firebase_admin._apps:
        raise ValueError("Firebase Admin SDK is not initialized.")
    
    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise ValueError("Google sign-in token has expired. Please try again.")
    except firebase_auth.RevokedIdTokenError:
        raise ValueError("Google sign-in token has been revoked.")
    except firebase_auth.InvalidIdTokenError:
        raise ValueError("Invalid Google sign-in token.")
    except Exception as e:
        raise ValueError(f"Failed to verify Google token: {str(e)}")

