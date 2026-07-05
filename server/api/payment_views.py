import os
from decimal import Decimal
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.conf import settings


from .models import WalletTransaction, User
from .serializers import WalletTransactionSerializer
from .notifications import send_push_notification
from .paymongo_service import create_gcash_source, retrieve_source, create_payment

# ── PayMongo GCash Endpoints ──────────────────────────────────────────────────────
# Coordinates the creation of sandbox GCash checkouts and processes verified charges
# ──────────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_paymongo_source(request):
    """
    Creates a PayMongo source for GCash top-up or ride payment.
    Expects {'amount': 150.00, 'ride_id': Optional[int]}
    """
    # Check if GCash is enabled
    secret_key = os.environ.get("PAYMONGO_SECRET_KEY", "").strip()
    is_test_mode = secret_key.startswith("sk_test_") or not secret_key
    default_enabled = 'true' if is_test_mode else 'false'
    gcash_enabled = getattr(settings, 'GCASH_ENABLED', os.environ.get('GCASH_ENABLED', default_enabled).lower() == 'true')
    if not gcash_enabled:
        return Response({'detail': 'GCash payments are currently disabled.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    amount = request.data.get('amount')
    ride_id = request.data.get('ride_id')
    
    if not amount:
        return Response({'detail': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        amt = Decimal(str(amount))
        if amt <= 0: 
            return Response({'detail': 'Amount must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)
        if amt < 50:
            return Response({'detail': 'Minimum payment amount is ₱50'}, status=status.HTTP_400_BAD_REQUEST)
        if amt > 50000:
            return Response({'detail': 'Maximum payment amount is ₱50,000'}, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, TypeError):
        return Response({'detail': 'Invalid amount format'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'detail': f'Amount validation error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Get frontend URL for redirects. Fallback to localhost.
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    
    # For ride payments, encode ride_id in the redirect URL so Wallet.jsx
    # can detect it and route the passenger back home after verification.
    if ride_id:
        success_url = f"{frontend_url}/wallet?status=success&type=ride&ride_id={ride_id}"
        failed_url  = f"{frontend_url}/wallet?status=failed&type=ride&ride_id={ride_id}"
    else:
        success_url = f"{frontend_url}/wallet?status=success"
        failed_url  = f"{frontend_url}/wallet?status=failed"
    
    # Call the service layer to create GCash source
    try:
        ok, data = create_gcash_source(amt, success_url, failed_url)
        if not ok:
            error_detail = data.get('detail', 'PayMongo Source generation failed')
            # Check if it's a configuration error
            if 'PAYMONGO_SECRET_KEY' in error_detail or 'environment variable' in error_detail:
                return Response({'detail': 'Payment gateway not configured. Please contact support.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            # Check if it's a GCash permission error
            if 'not allowed to process gcash' in error_detail.lower():
                return Response({'detail': 'GCash payments not enabled for this account. Please contact PayMongo support or use cash/wallet payment.'}, status=status.HTTP_403_FORBIDDEN)
            return Response({'detail': error_detail}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'detail': f'Payment gateway error: {str(e)}'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
    # Expose redirect URL and source ID
    checkout_url = data['attributes']['redirect']['checkout_url']
    source_id = data['id']
    
    return Response({
        'checkout_url': checkout_url,
        'source_id': source_id,
        'amount': amount
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_paymongo_payment(request):
    """
    Verifies a PayMongo GCash source and either completes a ride or credits the wallet.

    Query params:
      - source_id  (required) : PayMongo source ID returned by GCash
      - ride_id    (optional) : ride PK — when present this is a ride payment
    """
    source_id = request.query_params.get('source_id')
    if not source_id:
        return Response({'detail': 'source_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

    ride_id   = request.query_params.get('ride_id')

    from .models import Ride, LGURevenue, SystemConfig

    # ── 1. Idempotency guards ──────────────────────────────────────────────────
    # For ride payments: if ride is already completed, just return success.
    if ride_id:
        try:
            ride = Ride.objects.get(id=ride_id)
            if ride.status == 'completed':
                return Response({
                    'success': True,
                    'is_ride_payment': True,
                    'ride_id': ride.id,
                    'amount': str(ride.fare or 0),
                    'message': 'Ride was already completed.'
                })
        except Ride.DoesNotExist:
            return Response({'detail': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        # For wallet top-ups: prevent double credit
        existing_txn = WalletTransaction.objects.filter(reference_id=source_id).first()
        if existing_txn:
            return Response({
                'success': True,
                'is_ride_payment': False,
                'balance': str(request.user.wallet_balance),
                'reference_id': existing_txn.reference_id,
                'message': 'Transaction was already successfully processed.'
            })

    # ── 2. Retrieve source from PayMongo ──────────────────────────────────────
    ok, data = retrieve_source(source_id)
    if not ok:
        return Response(
            {'detail': data.get('detail', 'Could not retrieve source from PayMongo')},
            status=status.HTTP_400_BAD_REQUEST
        )

    source_status   = data['attributes']['status']
    amount_centavos = data['attributes']['amount']
    amount_php      = Decimal(amount_centavos) / 100

    # ── 3. Charge the source if chargeable ────────────────────────────────────
    if source_status == 'chargeable':
        charge_ok, charge_data = create_payment(amount_centavos, source_id)
        if not charge_ok:
            return Response(
                {'detail': charge_data.get('detail', 'PayMongo charge execution failed')},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_status = charge_data['attributes']['status']
        if payment_status != 'succeeded':
            return Response(
                {'detail': f'Charge returned status: {payment_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if ride_id:
            # ── RIDE PAYMENT FLOW ─────────────────────────────────────────────
            try:
                with transaction.atomic():
                    ride = Ride.objects.select_for_update().get(id=ride_id)

                    if ride.status != 'completed':
                        ride.status       = 'completed'
                        ride.completed_at = timezone.now()

                        # Calculate commission
                        commission_rate_config = SystemConfig.objects.filter(key='lgu_commission_rate').first()
                        commission_rate = (
                            Decimal(commission_rate_config.value)
                            if commission_rate_config
                            else Decimal('5.00')
                        )
                        total_fare      = ride.fare or Decimal('0.00')
                        lgu_commission  = (total_fare * commission_rate) / Decimal('100')
                        driver_earnings = total_fare - lgu_commission

                        ride.lgu_commission  = lgu_commission
                        ride.driver_earnings = driver_earnings
                        ride.commission_rate = commission_rate
                        ride.save()

                        # Credit driver wallet
                        if ride.driver:
                            driver = User.objects.select_for_update().get(id=ride.driver_id)
                            driver.wallet_balance += driver_earnings
                            driver.save()

                            WalletTransaction.objects.create(
                                user=driver,
                                amount=driver_earnings,
                                transaction_type='driver_earning',
                                reference_id=f'RIDE-GCASH-{ride.id}',
                                description=(
                                    f'Ride #{ride.id} GCash payment '
                                    f'(₱{total_fare} fare - ₱{lgu_commission} LGU commission)'
                                )
                            )

                            # Push notification to driver
                            send_push_notification(
                                driver,
                                "Ride Paid via GCash 💰",
                                f"Passenger paid ₱{amount_php:.2f} via GCash. "
                                f"₱{driver_earnings:.2f} credited to your wallet."
                            )

                        # Log LGU revenue
                        LGURevenue.objects.create(
                            ride=ride,
                            amount=lgu_commission,
                            commission_rate=commission_rate,
                            notes=f'GCash payment commission — Ride #{ride.id}'
                        )

                    # Push notification to passenger
                    send_push_notification(
                        ride.passenger,
                        "GCash Payment Successful 💳",
                        f"₱{amount_php:.2f} paid for Ride #{ride.id}. Thank you!"
                    )

                return Response({
                    'success':         True,
                    'is_ride_payment': True,
                    'ride_id':         ride.id,
                    'amount':          str(amount_php),
                    'message':         'Ride payment verified and completed!'
                })
            except Ride.DoesNotExist:
                return Response({'detail': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        else:
            # ── WALLET TOP-UP FLOW ────────────────────────────────────────────
            with transaction.atomic():
                user = User.objects.select_for_update().get(id=request.user.id)
                user.wallet_balance += amount_php
                user.save()

                WalletTransaction.objects.create(
                    user=user,
                    amount=amount_php,
                    transaction_type='topup',
                    reference_id=source_id,
                    description='GCash Wallet Top-up'
                )

            send_push_notification(
                user,
                "GCash Loaded 💰",
                f"₱{amount_php:.2f} added to your wallet. New balance: ₱{user.wallet_balance:.2f}"
            )

            return Response({
                'success':         True,
                'is_ride_payment': False,
                'balance':         str(user.wallet_balance),
                'reference_id':    source_id,
                'message':         'Wallet credited successfully!'
            })

    elif source_status == 'pending':
        return Response({
            'success': False,
            'status':  'pending',
            'detail':  'Payment is still pending in GCash. Please complete authentication.'
        })
    else:
        return Response({
            'success': False,
            'status':  source_status,
            'detail':  f'Source is {source_status} — cannot be charged.'
        })

