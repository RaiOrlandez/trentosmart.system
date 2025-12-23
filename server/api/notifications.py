import os
import logging

logger = logging.getLogger(__name__)

def send_sms(to_phone, message):
    """
    Simulates sending an SMS via Twilio or another cellular provider.
    In production, this would call an external API.
    """
    if not to_phone:
        logger.warning("Attempted to send SMS, but no phone number provided.")
        return False
    
    # Simulation: Log to console/terminal
    print("\n" + "="*50)
    print(f"📲 [SMS ALERT] TO: {to_phone}")
    print(f"💬 MESSAGE: {message}")
    print("="*50 + "\n")
    
    logger.info(f"SMS simulation sent to {to_phone}")
    return True

def send_push_notification(user, title, body):
    """
    Simulates sending a push notification via Firebase Cloud Messaging (FCM).
    """
    print("\n" + "*"*50)
    print(f"🔔 [PUSH NOTIFICATION] USER: {user.username}")
    print(f"📌 TITLE: {title}")
    print(f"📄 BODY: {body}")
    print("*"*50 + "\n")
    
    logger.info(f"Push notification simulation sent to {user.username}")
    return True
