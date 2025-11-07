from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/status")
async def api_status():
    return {"status": "ok", "message": "FastAPI backend (minimal)"}


@app.get("/api/members")
async def list_members():
    # Minimal example response — replace with DB-backed data later
    return {"members": [{"id": 1, "name": "Alice", "paid": True}, {"id": 2, "name": "Bob", "paid": False}]}
