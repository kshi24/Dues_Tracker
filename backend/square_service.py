import uuid
from typing import Dict
from square.client import Square, SquareEnvironment
import os


class SquarePaymentService:
    def __init__(self):
        from square.client import SquareEnvironment
    
        env = os.getenv('SQUARE_ENVIRONMENT', 'sandbox')
        self.client = Square(
            token=os.getenv('SQUARE_ACCESS_TOKEN'),
            environment=SquareEnvironment.SANDBOX if env == 'sandbox' else SquareEnvironment.PRODUCTION
        )
        self.location_id = os.getenv('SQUARE_LOCATION_ID')

    def create_payment(self, amount: float, source_id: str, 
                       member_email: str, member_name: str) -> Dict:
        """Create a payment using Square API"""
        try:
            result = self.client.payments.create_payment(
                body={
                    "source_id": source_id,
                    "idempotency_key": str(uuid.uuid4()),
                    "amount_money": {
                        "amount": int(amount * 100),  # Convert to cents
                        "currency": "USD"
                    },
                    "location_id": self.location_id,
                    "buyer_email_address": member_email,
                    "note": f"Payment from {member_name}"
                }
            )
            
            if result.is_success():
                payment = result.result['payment']
                return {
                    "success": True,
                    "transaction_id": payment['id'],
                    "status": payment['status'],
                    "amount": payment['amount_money']['amount'] / 100,
                    "receipt_url": payment.get('receipt_url'),
                    "receipt_number": payment.get('receipt_number'),
                    "created_at": payment['created_at'],
                    "message": "Payment successful"
                }
            else:
                return {
                    "success": False,
                    "message": f"Payment failed: {result.errors}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error processing payment: {str(e)}"
            }

    def create_payment_link(self, amount: float, member_name: str,
                           member_id: int, member_email: str) -> Dict:
        """Create a Square payment link"""
        try:
            result = self.client.checkout.create_payment_link(
                body={
                    "quick_pay": {
                        "name": f"TAMID Dues - {member_name}",
                        "price_money": {
                            "amount": int(amount * 100),
                            "currency": "USD"
                        },
                        "description": f"Dues payment for {member_name}",
                    }
                }
            )

            if result.is_success():
                payment_link = result.result['payment_link']
                return {
                    "success": True,
                    "payment_link_url": payment_link['url'],
                    "payment_link_id": payment_link['id'],
                    "message": "Payment link created successfully"
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to create payment link: {result.errors}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error creating payment link: {str(e)}"
            }

    def get_payment(self, payment_id: str) -> Dict:
        """Get payment details from Square"""
        try:
            result = self.client.payments.get_payment(payment_id)
            
            if result.is_success():
                payment = result.result['payment']
                return {
                    "success": True,
                    "payment_id": payment['id'],
                    "status": payment['status'],
                    "amount": payment['amount_money']['amount'] / 100,
                    "currency": payment['amount_money']['currency'],
                    "created_at": payment['created_at'],
                    "updated_at": payment['updated_at'],
                    "receipt_url": payment.get('receipt_url')
                }
            else:
                return {
                    "success": False,
                    "message": f"Payment not found: {result.errors}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error retrieving payment: {str(e)}"
            }