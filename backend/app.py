from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, init_db, Member, Transaction, Expense, SessionLocal, MemberClass, ClassDueDate
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from config import SLACK_WEBHOOK_URL, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID
import os
from jose import jwt, JWTError
from passlib.context import CryptContext
from slack_service import SlackMessagingService
from square_service import SquarePaymentService
from reminder_scheduler import ReminderScheduler, setup_default_reminders
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Initialize database & lightweight schema migration
init_db()

def ensure_initial_admin():
    """Seed the initial admin user if not present."""
    db = SessionLocal()
    try:
        existing = db.query(Member).filter(Member.email == "shibatakyle@gmail.com").first()
        if not existing:
            admin = Member(
                name="Kyle Shibata",
                email="shibatakyle@gmail.com",
                role="Admin",
                dues_amount=180.0,
                amount_paid=0.0,
                payment_status="Pending",
                password_hash=pwd_context.hash("abcd")
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
    finally:
        db.close()

ensure_initial_admin()

app = FastAPI(title="TAMID Dues Tracker API")

# ============ Status Computation Helper ============
def compute_member_status(member, now=None):
    """Derive payment status based on amount paid vs dues and due date timing.
    Rules:
      - Paid: amount_paid >= dues_amount
      - Overdue: not paid AND due_date exists AND now > due_date
      - Pending: all other not-paid cases (including no due_date yet or due_date in future)
    """
    if now is None:
        now = datetime.utcnow()
    try:
        if member.amount_paid >= (member.dues_amount or 0):
            return "Paid"
        if member.due_date and now > member.due_date:
            return "Overdue"
        return "Pending"
    except Exception:
        return member.payment_status or "Pending"

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
    due_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class MemberUpdate(BaseModel):
    payment_status: Optional[str] = None
    amount_paid: Optional[float] = None
    dues_amount: Optional[float] = None
    due_date: Optional[datetime] = None

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

# ============ Auth Models ============
class LoginRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    member_id: int
    name: str

class MemberAddRequest(BaseModel):
    name: str
    email: EmailStr
    member_class: Optional[str] = None
    phone: Optional[str] = None
    dues_amount: Optional[float] = None  # if None and class supplied, derive from class
    due_date: Optional[datetime] = None

class UpgradeAdminRequest(BaseModel):
    email: EmailStr

class UpgradeTreasurerRequest(BaseModel):
    email: EmailStr

class MemberClassCreate(BaseModel):
    name: str
    dues_amount: float

class MemberClassResponse(BaseModel):
    id: int
    name: str
    dues_amount: float
    active: bool
    created_at: datetime
    class Config:
        from_attributes = True

def create_access_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    # simple exp - optional future enhancement
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False

def get_current_user(token: str = Depends(lambda authorization=Depends(lambda: None): authorization)):
    """Placeholder dependency if extended security is needed via OAuth2PasswordBearer.
    For now we manually parse the Authorization header using a custom lambda approach.
    Will be replaced by OAuth2PasswordBearer in future iterations.
    """
    from fastapi import Request
    request: Request
    # Extract Authorization header manually
    # NOTE: Simplicity over robustness; production should use OAuth2PasswordBearer
    # We'll parse inside endpoint-level helper instead of global dependency.
    return None

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def get_authorization_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth scheme")
    return authorization.split(" ", 1)[1].strip()

def get_user_from_token(db: Session, token: str) -> Member:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")
    user = db.query(Member).filter(Member.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_admin(db: Session, token: str) -> Member:
    user = get_user_from_token(db, token)
    if user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return user

def require_admin_or_treasurer(db: Session, token: str) -> Member:
    user = get_user_from_token(db, token)
    if user.role not in ("Admin", "Treasurer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Treasurer privileges required")
    return user

# ============ Authentication Endpoints ============
@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Member).filter(Member.email == request.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Admin requires password; members can login by email only (invite model)
    if user.role == "Admin":
        if not request.password or not verify_password(request.password, user.password_hash or ""):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    else:
        # For members: optionally allow password if later implemented; currently email-only
        pass

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return LoginResponse(access_token=token, role=user.role, member_id=user.id, name=user.name)

@app.post("/api/auth/add-member", response_model=MemberResponse)
async def add_member(new_member: MemberAddRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    # Allow Treasurer as well as Admin to add members
    require_admin_or_treasurer(db, token)
    existing = db.query(Member).filter(Member.email == new_member.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Member with this email already exists")
    # derive dues from class if not explicitly provided
    dues_amount = new_member.dues_amount
    if dues_amount is None and new_member.member_class:
        mc = db.query(MemberClass).filter(MemberClass.name == new_member.member_class, MemberClass.active == True).first()
        if mc:
            dues_amount = mc.dues_amount
    if dues_amount is None:
        dues_amount = 180.0
    member = Member(
        name=new_member.name,
        email=new_member.email,
        member_class=new_member.member_class,
        phone=new_member.phone,
        dues_amount=dues_amount,
        amount_paid=0.0,
        payment_status="Pending",
        role="Member",
        due_date=new_member.due_date
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@app.post("/api/auth/upgrade-admin", response_model=MemberResponse)
async def upgrade_admin(req: UpgradeAdminRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)
    member = db.query(Member).filter(Member.email == req.email).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "Admin":
        return member  # already admin
    member.role = "Admin"
    # Optionally set a default password if none exists (admin can later change it)
    if not member.password_hash:
        member.password_hash = pwd_context.hash("changeme123")
    db.commit()
    db.refresh(member)
    return member

@app.post("/api/auth/upgrade-treasurer", response_model=MemberResponse)
async def upgrade_treasurer(req: UpgradeTreasurerRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)  # Only Admins can assign Treasurer role
    member = db.query(Member).filter(Member.email == req.email).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = "Treasurer"
    db.commit()
    db.refresh(member)
    return member

# ============ Member Deletion (Admin Only) ============
@app.delete("/api/members/{member_id}")
async def delete_member(member_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "Admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin accounts")
    # Decouple existing transactions: preserve history by nulling member_id and keeping snapshot fields
    existing_txs = db.query(Transaction).filter(Transaction.member_id == member_id).all()
    for tx in existing_txs:
        tx.member_id = None  # detach
    db.delete(member)
    db.commit()
    return {"success": True, "message": "Member deleted; detached transactions", "detached_transactions": len(existing_txs)}

# ============ Member Class Endpoints ============
@app.get("/api/classes", response_model=List[MemberClassResponse])
async def list_classes(db: Session = Depends(get_db)):
    classes = db.query(MemberClass).filter(MemberClass.active == True).order_by(MemberClass.name.asc()).all()
    return classes

@app.post("/api/classes", response_model=MemberClassResponse)
async def create_class(new_class: MemberClassCreate, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    # Allow Treasurer as well as Admin to create/revive classes
    require_admin_or_treasurer(db, token)
    existing = db.query(MemberClass).filter(MemberClass.name == new_class.name).first()
    if existing and existing.active:
        raise HTTPException(status_code=400, detail="Class name already exists")
    if existing and not existing.active:
        # revive
        existing.active = True
        existing.dues_amount = new_class.dues_amount
        db.commit()
        db.refresh(existing)
        return existing
    mc = MemberClass(name=new_class.name, dues_amount=new_class.dues_amount, active=True)
    db.add(mc)
    db.commit()
    db.refresh(mc)
    return mc

@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)
    mc = db.query(MemberClass).filter(MemberClass.id == class_id).first()
    if not mc or not mc.active:
        raise HTTPException(status_code=404, detail="Class not found")
    # Prevent deletion if members currently use this class name
    in_use = db.query(Member).filter(Member.member_class == mc.name).count() > 0
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete class while members reference it")
    mc.active = False
    db.commit()
    return {"success": True, "message": "Class removed"}

class ClassDueDateRequest(BaseModel):
    due_date: Optional[datetime] = None  # null clears due dates
    class_names: List[str]

@app.post("/api/classes/due-date")
async def set_due_date_for_classes(req: ClassDueDateRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Bulk apply (or clear) a due date to all members in the given class names.
    Sends no Slack notifications; purely a data update.
    """
    token = get_authorization_token(authorization)
    require_admin(db, token)
    if not req.class_names:
        raise HTTPException(status_code=400, detail="No class names provided")
    # Only consider active classes
    active_names = [c.name for c in db.query(MemberClass).filter(MemberClass.name.in_(req.class_names), MemberClass.active == True)]
    if not active_names:
        return {"updated": 0, "due_date": req.due_date, "class_names": req.class_names, "skipped": req.class_names}
    members = db.query(Member).filter(Member.member_class.in_(active_names)).all()
    for m in members:
        m.due_date = req.due_date
    db.commit()
    return {"updated": len(members), "due_date": req.due_date, "class_names": active_names}

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
    """Get all members with dynamically updated payment statuses."""
    members = db.query(Member).all()
    now = datetime.utcnow()
    dirty = False
    for m in members:
        derived = compute_member_status(m, now)
        if derived != m.payment_status:
            m.payment_status = derived
            dirty = True
    if dirty:
        db.commit()
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
    """Get a specific member by ID and ensure status is current."""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    derived = compute_member_status(member)
    if derived != member.payment_status:
        member.payment_status = derived
        db.commit()
        db.refresh(member)
    return member

@app.patch("/api/members/{member_id}", response_model=MemberResponse)
async def update_member(member_id: int, update: MemberUpdate,
                        background_tasks: BackgroundTasks,
                        db: Session = Depends(get_db)):
    """Update mutable numeric fields and/or due_date; payment_status is derived automatically."""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    old_status = member.payment_status
    # Ignore direct payment_status overrides; rely on computation
    if update.amount_paid is not None:
        member.amount_paid = update.amount_paid
    if update.dues_amount is not None:
        member.dues_amount = update.dues_amount
    if update.due_date is not None:
        member.due_date = update.due_date
    # Recompute
    member.payment_status = compute_member_status(member)
    db.commit()
    db.refresh(member)
    derived = member.payment_status
    if derived != old_status:
        background_tasks.add_task(
            slack_service.send_status_update_notification,
            member_name=member.name,
            old_status=old_status,
            new_status=derived,
            updated_by="System"
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

    result = square_service.create_payment(
        amount=payment.amount,
        source_id=payment.source_id,
        member_email=member.email,
        member_name=member.name
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Payment failed"))

    transaction = Transaction(
        member_id=member.id,
        amount=payment.amount,
        payment_method="Square",
        transaction_id=result["transaction_id"],
        status=result.get("status", "Completed"),
        payer_name=member.name,
        dues_due_date=member.due_date,
        display_label=f"{member.name} dues {member.due_date.date() if member.due_date else ''}",
        transaction_date=datetime.utcnow()
    )
    db.add(transaction)

    # Update member payment info
    member.amount_paid += payment.amount
    member.payment_status = compute_member_status(member)
    db.commit()
    db.refresh(member)

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

class ManualTransactionRequest(BaseModel):
    payer_name: str
    amount: float
    payment_method: Optional[str] = "Manual"
    transaction_date: Optional[datetime] = None
    dues_due_date: Optional[datetime] = None
    status: Optional[str] = "Completed"
    member_id: Optional[int] = None  # optional association if member still exists

class ManualTransactionResponse(BaseModel):
    id: int
    payer_name: str
    amount: float
    payment_method: str
    transaction_date: Optional[datetime]
    dues_due_date: Optional[datetime]
    display_label: Optional[str]
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

@app.post("/api/transactions/record", response_model=ManualTransactionResponse)
async def record_manual_transaction(req: ManualTransactionRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)
    assoc_member = None
    if req.member_id:
        assoc_member = db.query(Member).filter(Member.id == req.member_id).first()
    display_label = f"{req.payer_name} dues {req.dues_due_date.date() if req.dues_due_date else ''}".strip()
    tx = Transaction(
        member_id=assoc_member.id if assoc_member else None,
        amount=req.amount,
        payment_method=req.payment_method or "Manual",
        transaction_id=f"manual-{int(datetime.utcnow().timestamp())}-{req.payer_name[:8]}",
        status=req.status or "Completed",
        payer_name=req.payer_name,
        dues_due_date=req.dues_due_date,
        display_label=display_label,
        transaction_date=req.transaction_date or datetime.utcnow()
    )
    db.add(tx)
    # Optionally adjust member amount_paid if still associated
    if assoc_member:
        assoc_member.amount_paid += req.amount
        assoc_member.payment_status = compute_member_status(assoc_member)
    db.commit()
    db.refresh(tx)
    return tx

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

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin_or_treasurer(db, token)
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"success": True, "deleted_transaction": transaction_id}

@app.get("/api/transactions/member/{member_id}")
async def get_member_transactions(member_id: int, db: Session = Depends(get_db)):
    """Get all transactions for a specific member"""
    transactions = db.query(Transaction).filter(Transaction.member_id == member_id).all()
    return transactions

@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get overall payment statistics including dynamic overdue based on due_date."""
    now = datetime.utcnow()
    total_members = db.query(Member).count()
    paid_members = db.query(Member).filter(Member.payment_status == "Paid").count()
    pending_members = db.query(Member).filter(Member.payment_status == "Pending").count()
    overdue_members = db.query(Member).filter(
        Member.payment_status != "Paid",
        Member.due_date != None,
        Member.due_date < now
    ).count()

    # Use SQLAlchemy func for aggregate sums
    total_expected = db.query(func.sum(Member.dues_amount)).scalar() or 0
    total_collected = db.query(func.sum(Member.amount_paid)).scalar() or 0
    outstanding = total_expected - total_collected

    # Expenses & financial KPIs
    total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0
    net_income = total_collected - total_expenses
    BUDGET_TARGET = float(os.getenv("ANNUAL_BUDGET", 12000))
    budget_remaining = BUDGET_TARGET - total_expenses

    collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

    return {
        "total_members": total_members,
        "paid_members": paid_members,
        "pending_members": pending_members,
        "overdue_members": overdue_members,
        "total_expected": float(total_expected),
        "total_collected": float(total_collected),
        "outstanding_balance": float(outstanding),
        "collection_rate": round(collection_rate, 2),
        "total_expenses": round(float(total_expenses), 2),
        "net_income": round(float(net_income), 2),
        "budget_target": round(BUDGET_TARGET, 2),
        "budget_remaining": round(float(budget_remaining), 2)
    }

class SampleSeedResponse(BaseModel):
    classes_created: int
    members_created: int
    transactions_created: int
    expenses_created: int
    months_span: int

class SampleResetResponse(BaseModel):
    members_removed: int
    classes_removed: int
    transactions_removed: int
    expenses_removed: int
    due_dates_removed: int
    preserved_admin_email: str

class ClassDueDateResponse(BaseModel):
    id: int
    due_date: datetime
    class_names: List[str]
    created_at: datetime
    members_updated: int = 0
    class Config:
        from_attributes = True

@app.post("/api/sample/seed", response_model=SampleSeedResponse)
async def seed_sample_data(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Seed demo classes, members, transactions, and expenses for charts/testing.
    Idempotent-ish: will not duplicate existing class names or member emails.
    """
    token = get_authorization_token(authorization)
    require_admin(db, token)
    now = datetime.utcnow()
    # Classes
    demo_classes = [
        ("Alpha", 180.0), ("Beta", 200.0), ("Gamma", 220.0)
    ]
    classes_created = 0
    for name, dues in demo_classes:
        existing = db.query(MemberClass).filter(MemberClass.name == name).first()
        if not existing:
            mc = MemberClass(name=name, dues_amount=dues, active=True)
            db.add(mc)
            classes_created += 1
    db.commit()

    # Members
    demo_members = [
        ("Alice Alpha", "alice.alpha@example.com", "Alpha"),
        ("Bob Beta", "bob.beta@example.com", "Beta"),
        ("Gina Gamma", "gina.gamma@example.com", "Gamma"),
        ("Henry Alpha", "henry.alpha@example.com", "Alpha"),
        ("Paula Beta", "paula.beta@example.com", "Beta")
    ]
    members_created = 0
    for name, email, cls in demo_members:
        if not db.query(Member).filter(Member.email == email).first():
            class_ref = db.query(MemberClass).filter(MemberClass.name == cls).first()
            dues = class_ref.dues_amount if class_ref else 180.0
            m = Member(
                name=name,
                email=email,
                member_class=cls,
                dues_amount=dues,
                amount_paid=0.0,
                payment_status="Pending",
                role="Member",
                due_date=now + timedelta(days=14)
            )
            db.add(m)
            members_created += 1
    db.commit()

    # Transactions (spread over last 6 months)
    members = db.query(Member).all()
    transactions_created = 0
    for idx, m in enumerate(members):
        # Create 1-3 payments per member
        for t in range((idx % 3) + 1):
            created_at = now - timedelta(days=30 * (t + 1))
            amount = min(m.dues_amount / ((idx % 3) + 1), m.dues_amount - m.amount_paid)
            if amount <= 0:
                continue
            tx = Transaction(
                member_id=m.id,
                amount=amount,
                payment_method="Square",
                transaction_id=f"demo-{m.id}-{t}-{int(created_at.timestamp())}",
                status="Completed",
                created_at=created_at
            )
            db.add(tx)
            m.amount_paid += amount
            if m.amount_paid >= m.dues_amount:
                m.payment_status = "Paid"
            transactions_created += 1
    db.commit()

    # Expenses (simulate events)
    expenses_created = 0
    expense_templates = [
        ("Workshop", 300.0, "Educational workshop", "Finance 101"),
        ("Social", 150.0, "Team social event", "Fall Social"),
        ("Operations", 500.0, "Ops software tools", "Tooling")
    ]
    admin = db.query(Member).filter(Member.role == "Admin").first()
    for i, (category, amount, description, event_name) in enumerate(expense_templates):
        created_at = now - timedelta(days=15 * (i + 1))
        exp_exists = db.query(Expense).filter(Expense.event_name == event_name).first()
        if not exp_exists:
            exp = Expense(
                category=category,
                amount=amount,
                description=description,
                event_name=event_name,
                created_by=admin.id if admin else None,
                created_at=created_at
            )
            db.add(exp)
            expenses_created += 1
    db.commit()

    return SampleSeedResponse(
        classes_created=classes_created,
        members_created=members_created,
        transactions_created=transactions_created,
        expenses_created=expenses_created,
        months_span=6
    )

@app.post("/api/sample/reset", response_model=SampleResetResponse)
async def reset_sample_data(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Remove all demo data except the original admin account (shibatakyle@gmail.com)."""
    token = get_authorization_token(authorization)
    require_admin(db, token)
    preserve_email = "shibatakyle@gmail.com"
    admin_member = db.query(Member).filter(Member.email == preserve_email).first()
    if not admin_member:
        raise HTTPException(status_code=400, detail="Preserved admin account missing; aborting reset")

    transactions_removed = db.query(Transaction).delete()
    expenses_removed = db.query(Expense).delete()
    due_dates_removed = db.query(ClassDueDate).delete()
    db.commit()

    removable_members = db.query(Member).filter(Member.email != preserve_email).all()
    members_removed = len(removable_members)
    for m in removable_members:
        db.delete(m)
    db.commit()

    classes_removed = db.query(MemberClass).delete()
    db.commit()

    admin_member.role = "Admin"
    db.commit()
    db.refresh(admin_member)

    return SampleResetResponse(
        members_removed=members_removed,
        classes_removed=classes_removed,
        transactions_removed=transactions_removed,
        expenses_removed=expenses_removed,
        due_dates_removed=due_dates_removed,
        preserved_admin_email=preserve_email
    )

@app.get("/api/due-dates", response_model=List[ClassDueDateResponse])
async def list_due_dates(db: Session = Depends(get_db)):
    records = db.query(ClassDueDate).order_by(ClassDueDate.created_at.desc()).all()
    out = []
    for r in records:
        out.append(ClassDueDateResponse(
            id=r.id,
            due_date=r.due_date,
            class_names=[c for c in r.classes_text.split(',') if c],
            created_at=r.created_at,
            members_updated=0
        ))
    return out

class CreateClassDueDate(BaseModel):
    due_date: datetime
    class_names: List[str]

@app.post("/api/due-dates", response_model=ClassDueDateResponse)
async def create_due_date(data: CreateClassDueDate, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    # Allow Treasurer as well as Admin to create due date records
    require_admin_or_treasurer(db, token)
    if not data.class_names:
        raise HTTPException(status_code=400, detail="class_names required")
    active_classes = [c.name for c in db.query(MemberClass).filter(MemberClass.name.in_(data.class_names), MemberClass.active == True)]
    if not active_classes:
        raise HTTPException(status_code=400, detail="No valid active classes provided")
    # Apply due_date to members of these classes
    members = db.query(Member).filter(Member.member_class.in_(active_classes)).all()
    for m in members:
        m.due_date = data.due_date
        m.payment_status = compute_member_status(m)
    record = ClassDueDate(due_date=data.due_date, classes_text=','.join(active_classes))
    db.add(record)
    db.commit()
    db.refresh(record)
    return ClassDueDateResponse(id=record.id, due_date=record.due_date, class_names=active_classes, created_at=record.created_at, members_updated=len(members))

@app.delete("/api/due-dates/{record_id}")
async def delete_due_date(record_id: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    token = get_authorization_token(authorization)
    require_admin(db, token)
    record = db.query(ClassDueDate).filter(ClassDueDate.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Due date record not found")
    classes = [c for c in record.classes_text.split(',') if c]
    # Clear due_date only if matches this record's due_date (avoid nuking manually edited dates)
    affected = db.query(Member).filter(Member.member_class.in_(classes), Member.due_date == record.due_date).all()
    for m in affected:
        m.due_date = None
        m.payment_status = compute_member_status(m)
    db.delete(record)
    db.commit()
    return {"removed": record_id, "classes": classes, "cleared_members": len(affected)}

@app.get("/api/stats/monthly")
async def monthly_stats(db: Session = Depends(get_db)):
    """Monthly aggregate of income (transactions) and expenses for last 6 months."""
    now = datetime.utcnow()
    # Build month labels recent -> oldest
    months = []
    for i in range(5, -1, -1):
        ref = now - timedelta(days=30 * i)
        label = ref.strftime("%Y-%m")
        months.append(label)

    from sqlalchemy import func
    tx_rows = db.query(func.strftime('%Y-%m', Transaction.created_at).label('m'), func.sum(Transaction.amount))\
        .filter(Transaction.created_at >= now - timedelta(days=180))\
        .group_by('m').all()
    tx_map = {row[0]: float(row[1] or 0) for row in tx_rows}

    exp_rows = db.query(func.strftime('%Y-%m', Expense.created_at).label('m'), func.sum(Expense.amount))\
        .filter(Expense.created_at >= now - timedelta(days=180))\
        .group_by('m').all()
    exp_map = {row[0]: float(row[1] or 0) for row in exp_rows}

    data = []
    for m in months:
        data.append({
            "month": m,
            "income": tx_map.get(m, 0.0),
            "expenses": exp_map.get(m, 0.0)
        })
    return {"months": data}

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