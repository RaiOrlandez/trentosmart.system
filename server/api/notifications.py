import os
import requests
import logging

logger = logging.getLogger(__name__)

def send_sms(to_phone, message):
    """
    Sends an actual SMS using Semaphore API (Standard for PH).
    If no API key provided in .env, falls back to simulated console logs.
    """
    if not to_phone:
        logger.warning("Attempted to send SMS, but no phone number provided.")
        return False
        
    semaphore_apikey = os.environ.get('SEMAPHORE_API_KEY')
    
    if semaphore_apikey:
        try:
            payload = {
                "apikey": semaphore_apikey,
                "number": to_phone,
                "message": message,
                "sendername": "TRNTSMRT" 
            }
            response = requests.post("https://api.semaphore.co/api/v4/messages", data=payload, timeout=5)
            
            if response.status_code == 200:
                logger.info(f"✅ Real SMS Dispatched to {to_phone} via Semaphore API.")
                return True
            else:
                logger.error(f"❌ Semaphore SMS Failed: {response.text}")
        except Exception as e:
            logger.error(f"❌ SMS Integration Error: {str(e)}")
            
    # Fallback to simulation 
    print("\n" + "="*50)
    print(f"📱 [SMS ALERT] TO: {to_phone}")
    print(f"💬 MESSAGE: {message}")
    if not semaphore_apikey:
        print("💡 NOTE: Set SEMAPHORE_API_KEY to send real text messages.")
    print("="*50 + "\n")
    
    logger.info(f"Simulated SMS sent to {to_phone}")
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
