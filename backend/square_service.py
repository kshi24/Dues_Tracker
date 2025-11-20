from square.client import Client
import os

class SquarePaymentService:
    def __init__(self):
        self.client = Client(
            access_token=os.getenv('SQUARE_ACCESS_TOKEN'),
            environment=os.getenv('SQUARE_ENVIRONMENT')
        )
        self.location_id = os.getenv('SQUARE_LOCATION_ID')
    
    def create_payment(self, amount: float, source_id: str, 
                       member_email: str, member_name: str) -> Dict:
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
                    "buyer_email_address": member_email
                }
            )
            
            if result.is_success():
                payment = result.body['payment']
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
                    "message": result.errors
                }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }