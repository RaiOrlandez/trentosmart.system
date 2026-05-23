import os
import requests
import base64
from django.conf import settings

# ── PayMongo SDK / Service Layer ──────────────────────────────────────────────────
# Standard PayMongo API endpoints and credentials management.
# Supports automatic fallback to public sandbox test credentials if not configured.
# ──────────────────────────────────────────────────────────────────────────────────

PAYMONGO_BASE_URL = "https://api.paymongo.com/v1"

def get_auth_header():
    """
    Returns the basic auth header for PayMongo.
    """
    secret_key = os.environ.get("PAYMONGO_SECRET_KEY", "").strip()
    if not secret_key:
        raise ValueError("PAYMONGO_SECRET_KEY environment variable is not configured.")
    # Basic Authentication requires the secret key as username and password left blank
    auth_str = f"{secret_key}:"
    auth_bytes = auth_str.encode("utf-8")
    auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")
    return {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

def create_gcash_source(amount_php, success_url, failed_url):
    """
    Creates a PayMongo source for GCash checkout.
    amount_php: float/Decimal (e.g. 100.00)
    Returns: (success: bool, data: dict)
    """
    url = f"{PAYMONGO_BASE_URL}/sources"
    
    # PayMongo amount is in centavos (e.g., 100 PHP is 10000 centavos)
    amount_centavos = int(float(amount_php) * 100)
    
    payload = {
        "data": {
            "attributes": {
                "type": "gcash",
                "amount": amount_centavos,
                "currency": "PHP",
                "redirect": {
                    "success": success_url,
                    "failed": failed_url
                }
            }
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=get_auth_header(), timeout=15)
        response_data = response.json()
        if response.status_code == 200 or response.status_code == 201:
            return True, response_data["data"]
        else:
            errors = response_data.get("errors", [{"detail": "Unknown PayMongo Error"}])
            return False, {"detail": errors[0]["detail"]}
    except Exception as e:
        return False, {"detail": str(e)}

def retrieve_source(source_id):
    """
    Retrieves the source status from PayMongo.
    """
    url = f"{PAYMONGO_BASE_URL}/sources/{source_id}"
    try:
        response = requests.get(url, headers=get_auth_header(), timeout=15)
        response_data = response.json()
        if response.status_code == 200:
            return True, response_data["data"]
        else:
            errors = response_data.get("errors", [{"detail": "Could not retrieve source"}])
            return False, {"detail": errors[0]["detail"]}
    except Exception as e:
        return False, {"detail": str(e)}

def create_payment(amount_centavos, source_id, description="TrentoSmart Wallet Top-up"):
    """
    Charges a chargeable source to create a Payment.
    """
    url = f"{PAYMONGO_BASE_URL}/payments"
    payload = {
        "data": {
            "attributes": {
                "amount": amount_centavos,
                "source": {
                    "id": source_id,
                    "type": "source"
                },
                "currency": "PHP",
                "description": description
            }
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=get_auth_header(), timeout=15)
        response_data = response.json()
        if response.status_code == 200 or response.status_code == 201:
            return True, response_data["data"]
        else:
            errors = response_data.get("errors", [{"detail": "Payment charge failed"}])
            return False, {"detail": errors[0]["detail"]}
    except Exception as e:
        return False, {"detail": str(e)}
