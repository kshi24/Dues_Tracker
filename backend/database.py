from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, inspect, text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

#sqlite db
# gets the slack API from .env
from config import DATABASE_URL
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    member_class = Column(String)  # cohort / class year
    dues_amount = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)
    payment_status = Column(String, default="Pending")  # Paid/Pending/Overdue
    role = Column(String, default="Member")  # Member/Admin
    password_hash = Column(String)  # bcrypt hash when password set
    created_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime)  # optional date by which dues should be paid

    transactions = relationship("Transaction", back_populates="member")

class MemberClass(Base):
    __tablename__ = "member_classes"
    __table_args__ = (UniqueConstraint('name', name='uq_member_class_name'),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    dues_amount = Column(Float, default=180.0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    amount = Column(Float, nullable=False)
    payment_method = Column(String)  # venmo/payPal/stripe/square (we're just doing square?)
    transaction_id = Column(String)  # external payment ID
    status = Column(String, default="Completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    # New decoupled metadata for resilience after member deletion
    payer_name = Column(String)  # snapshot of member name at time of transaction
    dues_due_date = Column(DateTime)  # snapshot of the dues deadline relevant to this payment
    display_label = Column(String)  # e.g. "Alice Alpha dues 2025-11-30"
    transaction_date = Column(DateTime)  # explicit date supplied (may equal created_at)
    
    member = relationship("Member", back_populates="transactions")


class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String)
    event_name = Column(String)
    created_by = Column(Integer, ForeignKey("members.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

class ClassDueDate(Base):
    __tablename__ = 'class_due_dates'

    id = Column(Integer, primary_key=True, index=True)
    due_date = Column(DateTime, nullable=False)
    classes_text = Column(String, nullable=False)  # comma-separated class names
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    """Create tables and perform lightweight, idempotent schema adjustments."""
    Base.metadata.create_all(bind=engine)

    # Ensure new column member_class exists (SQLite lacks ALTER via ORM)
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('members')]
    if 'member_class' not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE members ADD COLUMN member_class VARCHAR"))
            conn.commit()
    if 'due_date' not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE members ADD COLUMN due_date DATETIME"))
            conn.commit()
    # Ensure new transaction columns exist
    t_columns = [col['name'] for col in inspector.get_columns('transactions')]
    new_tx_cols = {
        'payer_name': 'ALTER TABLE transactions ADD COLUMN payer_name VARCHAR',
        'dues_due_date': 'ALTER TABLE transactions ADD COLUMN dues_due_date DATETIME',
        'display_label': 'ALTER TABLE transactions ADD COLUMN display_label VARCHAR',
        'transaction_date': 'ALTER TABLE transactions ADD COLUMN transaction_date DATETIME'
    }
    for col_name, ddl in new_tx_cols.items():
        if col_name not in t_columns:
            with engine.connect() as conn:
                conn.execute(text(ddl))
                conn.commit()
    # Backfill display_label & payer_name for existing rows missing them
    with engine.connect() as conn:
        # Only run if at least one of the new columns existed prior (simple heuristic)
        conn.execute(text("""
            UPDATE transactions SET
              payer_name = COALESCE(payer_name, (SELECT name FROM members WHERE members.id = transactions.member_id)),
              display_label = COALESCE(display_label, 
                (SELECT name || ' dues ' || COALESCE(strftime('%Y-%m-%d', members.due_date), '') FROM members WHERE members.id = transactions.member_id)
              )
            WHERE 1=1
        """))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()