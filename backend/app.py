from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, init_db, Member, Transaction, Expense, SessionLocal
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from config import SLACK_WEBHOOK_URL, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID
from slack_service import SlackMessagingService
from square_service import SquarePaymentService
from reminder_scheduler import ReminderScheduler, setup_default_reminders
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database
init_db()

app = FastAPI(title="TAMID Dues Tracker API")

# Initialize services
slack_service = SlackMessagingService(webhook_url=SLACK_WEBHOOK_URL)
square_service = SquarePaymentService()

# Initialize reminder scheduler
reminder_scheduler = ReminderScheduler(
    db_session_factory=lambda: SessionLocal(),
    slack_service=slack_service
)

# CORS configuration
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ Pydantic Models ============
class MemberCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    dues_amount: float = 180.0
    role: str = "Member"

class MemberResponse(BaseModel):
    id: int
    name: str
    email: str
    payment_status: str
    amount_paid: float
    dues_amount: float
    role: str
    phone: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class MemberUpdate(BaseModel):
    payment_status: Optional[str] = None
    amount_paid: Optional[float] = None
    dues_amount: Optional[float] = None

class ReminderRequest(BaseModel):
    member_ids: Optional[List[int]] = None
    send_to_all_unpaid: bool = False

class BulkReminderResponse(BaseModel):
    total_sent: int
    successful: int
    failed: int
    members_notified: List[str]

class PaymentRequest(BaseModel):
    member_id: int
    source_id: str
    amount: float

class PaymentLinkRequest(BaseModel):
    member_id: int

class ScheduleReminderRequest(BaseModel):
    reminder_type: str  # 'daily_overdue', 'weekly_summary', 'biweekly_pending'
    hour: Optional[int] = 9
    minute: Optional[int] = 0
    day_of_week: Optional[str] = 'mon'

class DeadlineReminderRequest(BaseModel):
    deadline_date: str  # ISO format date
    reminder_days_before: List[int] = [7, 3, 1]

# ============ Startup/Shutdown Events ============
@app.on_event("startup")
async def startup_event():
    """Start the reminder scheduler on application startup"""
    reminder_scheduler.start()
    
    # Set up default reminders (can be customized via API later)
    # Example: Set deadline for end of semester
    semester_end = datetime.now() + timedelta(days=90)
    setup_default_reminders(reminder_scheduler, payment_deadline=semester_end)
    
    logger.info("Application started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown the reminder scheduler"""
    reminder_scheduler.shutdown()
    logger.info("Application shutdown complete")

# ============ Basic API Endpoints ============
@app.get("/api/status")
async def api_status():
    """Get API status and configuration"""
    scheduler_jobs = reminder_scheduler.list_jobs()
    
    return {
        "status": "ok",
        "message": "TAMID Dues Tracker API with Slack & Square Integration",
        "timestamp": datetime.now().isoformat(),
        "slack_configured": bool(SLACK_WEBHOOK_URL),
        "square_configured": bool(SQUARE_APPLICATION_ID),
        "scheduler_running": reminder_scheduler.is_running,
        "scheduled_jobs": len(scheduler_jobs)
    }

@app.get("/api/members", response_model=List[MemberResponse])
async def list_members(db: Session = Depends(get_db)):
    """Get all members"""
    members = db.query(Member).all()
    return members

@app.post("/api/members", response_model=MemberResponse)
async def create_member(member: MemberCreate, db: Session = Depends(get_db)):
    """Create a new member"""
    db_member = Member(**member.dict())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@app.get("/api/members/{member_id}", response_model=MemberResponse)
async def get_member(member_id: int, db: Session = Depends(get_db)):
    """Get a specific member by ID"""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@app.patch("/api/members/{member_id}", response_model=MemberResponse)
async def update_member(member_id: int, update: MemberUpdate, 
                       background_tasks: BackgroundTasks,
                       db: Session = Depends(get_db)):
    """Update member payment status and amount"""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    old_status = member.payment_status
    
    if update.payment_status is not None:
        member.payment_status = update.payment_status
    if update.amount_paid is not None:
        member.amount_paid = update.amount_paid
    if update.dues_amount is not None:
        member.dues_amount = update.dues_amount
    
    db.commit()
    db.refresh(member)
    
    # Send Slack notification if status changed (in background)
    if update.payment_status and update.payment_status != old_status:
        background_tasks.add_task(
            slack_service.send_status_update_notification,
            member_name=member.name,
            old_status=old_status,
            new_status=update.payment_status,
            updated_by="Admin"
        )
    
    return member

# ============ Slack Integration Endpoints ============
@app.post("/api/reminders/individual/{member_id}")
async def send_individual_reminder(member_id: int, 
                                   background_tasks: BackgroundTasks,
                                   db: Session = Depends(get_db)):
    """Send payment reminder to a specific member via Slack"""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if member.payment_status.lower() == "paid":
        raise HTTPException(status_code=400, detail="Member has already paid")
    
    # Send reminder in background
    background_tasks.add_task(
        slack_service.send_individual_reminder,
        member_name=member.name,
        member_email=member.email,
        amount_due=member.dues_amount - member.amount_paid,
        status=member.payment_status
    )
    
    return {
        "success": True,
        "message": f"Reminder scheduled for {member.name}"
    }

@app.post("/api/reminders/bulk", response_model=BulkReminderResponse)
async def send_bulk_reminders(request: ReminderRequest, 
                              background_tasks: BackgroundTasks,
                              db: Session = Depends(get_db)):
    """Send reminders to multiple unpaid members via Slack"""
    if request.send_to_all_unpaid:
        unpaid_members = db.query(Member).filter(
            Member.payment_status.in_(["Pending", "Overdue", "pending", "overdue"])
        ).all()
    elif request.member_ids:
        unpaid_members = db.query(Member).filter(
            Member.id.in_(request.member_ids)
        ).all()
    else:
        raise HTTPException(status_code=400, detail="Must specify member_ids or send_to_all_unpaid")
    
    if not unpaid_members:
        return BulkReminderResponse(
            total_sent=0,
            successful=0,
            failed=0,
            members_notified=[]
        )
    
    # Prepare data for bulk summary
    unpaid_data = [
        {
            "name": m.name,
            "class": m.role,
            "amount_due": m.dues_amount - m.amount_paid,
            "status": m.payment_status
        }
        for m in unpaid_members
    ]
    
    # Send bulk summary in background
    background_tasks.add_task(
        slack_service.send_bulk_reminder_summary,
        unpaid_data=unpaid_data
    )
    
    return BulkReminderResponse(
        total_sent=len(unpaid_members),
        successful=len(unpaid_members),
        failed=0,
        members_notified=[m.name for m in unpaid_members]
    )

@app.post("/api/slack/test")
async def test_slack_connection():
    """Test Slack webhook connection"""
    result = slack_service.test_connection()
    return result

# ============ Square Payment Integration Endpoints ============
@app.post("/api/payments/process")
async def process_payment(payment: PaymentRequest, 
                         background_tasks: BackgroundTasks,
                         db: Session = Depends(get_db)):
    """Process a payment through Square and update database"""
    member = db.query(Member).filter(Member.id == payment.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Process payment via Square
    result = square_service.create_payment(
        amount=payment.amount,
        source_id=payment.source_id,
        member_email=member.email,
        member_name=member.name
    )
    
    if result["success"]:
        # Create transaction record
        transaction = Transaction(
            member_id=member.id,
            amount=payment.amount,
            payment_method="Square",
            transaction_id=result["transaction_id"],
            status=result["status"]
        )
        db.add(transaction)
        
        # Update member payment info
        member.amount_paid += payment.amount
        if member.amount_paid >= member.dues_amount:
            member.payment_status = "Paid"
        else:
            member.payment_status = "Pending"
        
        db.commit()
        
        # Send Slack notification in background
        background_tasks.add_task(
            slack_service.send_payment_confirmation,
            member_name=member.name,
            amount=payment.amount,
            payment_method="Square",
            transaction_id=result["transaction_id"]
        )
        
        return {
            "success": True,
            "message": "Payment processed successfully",
            "transaction_id": result["transaction_id"],
            "receipt_url": result.get("receipt_url"),
            "new_balance": member.amount_paid,
            "payment_status": member.payment_status
        }
    else:
        raise HTTPException(status_code=400, detail=result.get("message", "Payment failed"))

@app.post("/api/payments/create-link")
async def create_payment_link(request: PaymentLinkRequest, db: Session = Depends(get_db)):
    """Create a Square payment link for a member"""
    member = db.query(Member).filter(Member.id == request.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    amount_due = member.dues_amount - member.amount_paid
    
    if amount_due <= 0:
        raise HTTPException(status_code=400, detail="Member has no outstanding balance")
    
    result = square_service.create_payment_link(
        amount=amount_due,
        member_name=member.name,
        member_id=member.id,
        member_email=member.email
    )
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to create payment link"))

@app.get("/api/payments/{payment_id}")
async def get_payment_details(payment_id: str):
    """Get details of a Square payment"""
    result = square_service.get_payment(payment_id)
    
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=404, detail="Payment not found")

@app.get("/api/payments/config")
async def get_square_config():
    """Get Square configuration for frontend"""
    return {
        "application_id": SQUARE_APPLICATION_ID,
        "location_id": SQUARE_LOCATION_ID
    }

# ============ Scheduler Endpoints ============
@app.get("/api/scheduler/jobs")
async def list_scheduled_jobs():
    """List all scheduled reminder jobs"""
    jobs = reminder_scheduler.list_jobs()
    return {
        "scheduler_running": reminder_scheduler.is_running,
        "jobs": jobs,
        "total_jobs": len(jobs)
    }

@app.post("/api/scheduler/configure")
async def configure_reminder(request: ScheduleReminderRequest):
    """Configure a scheduled reminder"""
    try:
        if request.reminder_type == "daily_overdue":
            reminder_scheduler.add_daily_overdue_reminder(
                hour=request.hour,
                minute=request.minute
            )
        elif request.reminder_type == "weekly_summary":
            reminder_scheduler.add_weekly_summary(
                day_of_week=request.day_of_week,
                hour=request.hour,
                minute=request.minute
            )
        elif request.reminder_type == "biweekly_pending":
            reminder_scheduler.add_bi_weekly_pending_reminder(
                day_of_week=request.day_of_week,
                hour=request.hour,
                minute=request.minute
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid reminder type")
        
        return {
            "success": True,
            "message": f"Reminder '{request.reminder_type}' configured successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scheduler/deadline")
async def set_deadline_reminder(request: DeadlineReminderRequest):
    """Set up deadline reminders"""
    try:
        deadline_date = datetime.fromisoformat(request.deadline_date)
        reminder_scheduler.add_deadline_reminder(
            deadline_date=deadline_date,
            reminder_days_before=request.reminder_days_before
        )
        
        return {
            "success": True,
            "message": f"Deadline reminders set for {deadline_date.strftime('%Y-%m-%d')}",
            "reminder_days": request.reminder_days_before
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scheduler/pause/{job_id}")
async def pause_job(job_id: str):
    """Pause a scheduled job"""
    try:
        reminder_scheduler.pause_job(job_id)
        return {"success": True, "message": f"Job '{job_id}' paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scheduler/resume/{job_id}")
async def resume_job(job_id: str):
    """Resume a paused job"""
    try:
        reminder_scheduler.resume_job(job_id)
        return {"success": True, "message": f"Job '{job_id}' resumed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/scheduler/job/{job_id}")
async def delete_job(job_id: str):
    """Delete a scheduled job"""
    try:
        reminder_scheduler.remove_job(job_id)
        return {"success": True, "message": f"Job '{job_id}' deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ Transaction & Statistics Endpoints ============
@app.get("/api/transactions")
async def get_all_transactions(db: Session = Depends(get_db)):
    """Get all transactions"""
    transactions = db.query(Transaction).all()
    return transactions

@app.get("/api/transactions/member/{member_id}")
async def get_member_transactions(member_id: int, db: Session = Depends(get_db)):
    """Get all transactions for a specific member"""
    transactions = db.query(Transaction).filter(Transaction.member_id == member_id).all()
    return transactions

@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get overall payment statistics"""
    total_members = db.query(Member).count()
    paid_members = db.query(Member).filter(Member.payment_status == "Paid").count()
    pending_members = db.query(Member).filter(Member.payment_status == "Pending").count()
    overdue_members = db.query(Member).filter(Member.payment_status == "Overdue").count()
    
    total_expected = db.query(db.func.sum(Member.dues_amount)).scalar() or 0
    total_collected = db.query(db.func.sum(Member.amount_paid)).scalar() or 0
    outstanding = total_expected - total_collected
    
    collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0
    
    return {
        "total_members": total_members,
        "paid_members": paid_members,
        "pending_members": pending_members,
        "overdue_members": overdue_members,
        "total_expected": float(total_expected),
        "total_collected": float(total_collected),
        "outstanding_balance": float(outstanding),
        "collection_rate": round(collection_rate, 2)
    }

# ============ Health Check ============
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "slack": bool(SLACK_WEBHOOK_URL),
            "square": bool(SQUARE_APPLICATION_ID),
            "scheduler": reminder_scheduler.is_running
        }
    }