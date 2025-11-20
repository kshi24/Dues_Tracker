"""Square service - sandbox mode for testing"""
from typing import Dict, Optional
import uuid
from datetime import datetime

class SquarePaymentService:
    def __init__(self):
        print("✅ Square Payment Service initialized (sandbox mode)")
        self.location_id = "sandbox"
    
    def create_payment(self, amount: float, source_id: str, 
                       member_email: str, member_name: str) -> Dict:
        return {
            "success": True,
            "transaction_id": f"sq-{uuid.uuid4()}",
            "status": "COMPLETED",
            "amount": amount,
            "receipt_url": "https://squareup.com/receipt/preview",
            "receipt_number": f"SAND-{uuid.uuid4().hex[:8].upper()}",
            "created_at": datetime.now().isoformat(),
            "message": "Payment successful (sandbox)"
        }
    
    def get_payment(self, payment_id: str) -> Dict:
        return {
            "success": True,
            "payment": {
                "id": payment_id,
                "status": "COMPLETED",
                "amount": 180.0,
                "currency": "USD",
                "created_at": datetime.now().isoformat(),
                "receipt_url": "https://squareup.com/receipt",
                "receipt_number": "SANDBOX"
            }
        }
    
    def create_payment_link(self, amount: float, member_name: str, 
                           member_id: int, member_email: Optional[str] = None) -> Dict:
        return {
            "success": True,
            "payment_link_id": f"link-{uuid.uuid4()}",
            "url": f"https://square.link/u/SANDBOX?amount={amount}",
            "long_url": f"https://square.link/u/SANDBOX?amount={amount}&member={member_id}",
            "created_at": datetime.now().isoformat(),
            "message": "Payment link created (sandbox)"
        }
    
    def list_payments(self, begin_time: Optional[str] = None, 
                     end_time: Optional[str] = None, limit: int = 100) -> Dict:
        return {"success": True, "payments": [], "count": 0}
    
    def refund_payment(self, payment_id: str, amount: Optional[float] = None, 
                      reason: str = "Member request") -> Dict:
        return {
            "success": True,
            "refund_id": f"refund-{uuid.uuid4()}",
            "status": "COMPLETED",
            "amount_refunded": amount or 180.0,
            "created_at": datetime.now().isoformat(),
            "message": "Refund processed (sandbox)"
        }
    
    def verify_payment_card(self, source_id: str) -> Dict:
        return {"success": True, "message": "Card verified (sandbox)"}