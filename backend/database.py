from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey
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
    dues_amount = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)
    payment_status = Column(String, default="Pending")  # paid/pending/overdue
    role = Column(String, default="Member")  # member/treasurer/admin
    password_hash = Column(String)  # auth
    created_at = Column(DateTime, default=datetime.utcnow)
    
    transactions = relationship("Transaction", back_populates="member")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"))
    amount = Column(Float, nullable=False)
    payment_method = Column(String)  # venmo/payPal/stripe/square (we're just doing square?)
    transaction_id = Column(String)  # external payment ID
    status = Column(String, default="Completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    
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


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()