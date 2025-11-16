from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, init_db, Member, Transaction, Expense
from pydantic import BaseModel
from typing import List, Optional

init_db()

app = FastAPI(title="TAMID Dues Tracker API")

# Allow the React dev server (Vite default) to call the API during development
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MemberCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    dues_amount: float = 50.0
    role: str = "Member"

class MemberResponse(BaseModel):
    id: int
    name: str
    email: str
    payment_status: str
    amount_paid: float
    dues_amount: float
    
    class Config:
        from_attributes = True


@app.get("/api/status")
async def api_status():
    return {"status": "ok", "message": "FastAPI backend (minimal)"}

@app.get("/api/members", response_model=List[MemberResponse])
async def list_members(db: Session = Depends(get_db)):
    members = db.query(Member).all()
    return members

@app.post("/api/members", response_model=MemberResponse)
async def create_member(member: MemberCreate, db: Session = Depends(get_db)):
    db_member = Member(**member.dict())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@app.get("/api/members/{member_id}", response_model=MemberResponse)
async def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member