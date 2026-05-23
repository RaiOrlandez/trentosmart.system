import os
from decimal import Decimal
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone


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
    amount = request.data.get('amount')
    ride_id = request.data.get('ride_id')
    
    if not amount:
        return Response({'detail': 'Amount is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        amt = Decimal(str(amount))
        if amt <= 0: raise ValueError
    except ValueError:
        return Response({'detail': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Get frontend URL for redirects. Fallback to localhost.
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    success_url = f"{frontend_url}/wallet?status=success"
    failed_url = f"{frontend_url}/wallet?status=failed"
    
    # Call the service layer to create GCash source
    ok, data = create_gcash_source(amt, success_url, failed_url)
    if not ok:
        return Response({'detail': data.get('detail', 'PayMongo Source generation failed')}, status=status.HTTP_400_BAD_REQUEST)
        
    # Expose redirect URL and source ID
    checkout_url = data['attributes']['redirect']['checkout_url']
    source_id = data['id']
    
    # Link to Ride's Payment if ride_id is provided
    if ride_id:
        try:
            from .models import Ride
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
            if hasattr(ride, 'payment'):
                payment = ride.payment
                payment.provider_txn = source_id
                payment.save()
        except Ride.DoesNotExist:
            pass
    
    return Response({
        'checkout_url': checkout_url,
        'source_id': source_id,
        'amount': amount
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_paymongo_payment(request):
    """
    Verifies a pending source status from PayMongo.
    If the source status is 'chargeable', it calls create_payment to charge the source.
    If linked to a ride payment, it marks it as paid and ensures ride completion.
    Otherwise, it credits the user's wallet.
    Expects query param ?source_id=src_...
    """
    source_id = request.query_params.get('source_id')
    if not source_id:
        return Response({'detail': 'source_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    from .models import Payment, Ride, LGURevenue, SystemConfig
    
    # Check if this is a ride payment
    payment = Payment.objects.filter(provider_txn=source_id).first()
    
    # 1. Prevent double processing
    if payment:
        if payment.paid:
            return Response({
                'success': True,
                'is_ride_payment': True,
                'ride_id': payment.ride.id,
                'amount': str(payment.amount),
                'message': 'Ride payment was already successfully processed.'
            })
    else:
        existing_txn = WalletTransaction.objects.filter(reference_id=source_id).first()
        if existing_txn:
            return Response({
                'success': True,
                'is_ride_payment': False,
                'balance': request.user.wallet_balance,
                'reference_id': existing_txn.reference_id,
                'message': 'Transaction was already successfully processed.'
            })
        
    # 2. Retrieve source details from PayMongo API
    ok, data = retrieve_source(source_id)
    if not ok:
        return Response({'detail': data.get('detail', 'Could not retrieve source from PayMongo')}, status=status.HTTP_400_BAD_REQUEST)
        
    source_status = data['attributes']['status']
    amount_centavos = data['attributes']['amount']
    amount_php = Decimal(amount_centavos) / 100
    
    # 3. If source status is 'chargeable', perform the charge!
    if source_status == 'chargeable':
        # Create a payment (charge) against this source
        charge_ok, charge_data = create_payment(amount_centavos, source_id)
        if not charge_ok:
            return Response({'detail': charge_data.get('detail', 'PayMongo charge execution failed')}, status=status.HTTP_400_BAD_REQUEST)
            
        payment_status = charge_data['attributes']['status']
        if payment_status == 'succeeded':
            if payment:
                # ── RIDE PAYMENT FLOW ──
                with transaction.atomic():
                    payment.paid = True
                    payment.save()
                    
                    ride = payment.ride
                    if ride.status != 'completed':
                        ride.status = 'completed'
                        ride.completed_at = timezone.now()
                        
                        # Calculate LGU commission and driver earnings
                        commission_rate_config = SystemConfig.objects.filter(key='lgu_commission_rate').first()
                        commission_rate = Decimal(commission_rate_config.value) if commission_rate_config else Decimal('5.00')
                        total_fare = ride.fare or Decimal('0.00')
                        lgu_commission = (total_fare * commission_rate) / Decimal('100')
                        driver_earnings = total_fare - lgu_commission
                        
                        ride.lgu_commission = lgu_commission
                        ride.driver_earnings = driver_earnings
                        ride.commission_rate = commission_rate
                        ride.save()
                        
                        # Credit driver wallet
                        if ride.driver:
                            driver = ride.driver
                            driver.wallet_balance += driver_earnings
                            driver.save()
                            
                            WalletTransaction.objects.create(
                                user=driver,
                                amount=driver_earnings,
                                transaction_type='driver_earning',
                                reference_id=f'RIDE-{ride.id}',
                                description=f'Ride #{ride.id} earnings via GCash (₱{total_fare} - ₱{lgu_commission} LGU commission)'
                            )
                            
                        # Log LGU commission revenue
                        LGURevenue.objects.create(
                            ride=ride,
                            amount=lgu_commission,
                            commission_rate=commission_rate,
                            notes=f'Commission from GCash Ride #{ride.id}'
                        )
                
                # Push notifications
                send_push_notification(
                    payment.ride.passenger,
                    "Payment Received 💳",
                    f"GCash payment of ₱{amount_php} for Ride #{payment.ride.id} completed successfully!"
                )
                if payment.ride.driver:
                    send_push_notification(
                        payment.ride.driver,
                        "Ride Paid via GCash 💰",
                        f"Passenger paid ₱{amount_php} via GCash. Earnings ₱{payment.ride.driver_earnings} credited."
                    )
                
                return Response({
                    'success': True,
                    'is_ride_payment': True,
                    'ride_id': payment.ride.id,
                    'amount': str(amount_php),
                    'message': 'Ride payment successfully charged and verified!'
                })
            else:
                # ── WALLET TOP-UP FLOW ──
                with transaction.atomic():
                    user = User.objects.select_for_update().get(id=request.user.id)
                    user.wallet_balance += amount_php
                    user.save()
                    
                    # Create the wallet transaction record
                    WalletTransaction.objects.create(
                        user=user,
                        amount=amount_php,
                        transaction_type='topup',
                        reference_id=source_id,  # Use source_id to prevent double charging
                        description='GCash Top-up'
                    )
                    
                # Send real-time push notification of successful credit
                send_push_notification(
                    user,
                    "GCash Loaded 💰",
                    f"Successfully loaded ₱{amount_php} via GCash. Balance: ₱{user.wallet_balance}."
                )
                
                return Response({
                    'success': True,
                    'is_ride_payment': False,
                    'balance': user.wallet_balance,
                    'reference_id': source_id,
                    'message': 'Payment successfully charged and wallet credited!'
                })
        else:
            return Response({'detail': f'Charge execution returned status: {payment_status}'}, status=status.HTTP_400_BAD_REQUEST)
            
    elif source_status == 'pending':
        return Response({
            'success': False,
            'status': 'pending',
            'detail': 'Payment is still pending in GCash. Please complete authentication.'
        })
    else:
        return Response({
            'success': False,
            'status': source_status,
            'detail': f'Source state is {source_status}. Recharge is not possible.'
        })

