# TAMID Dues Tracker (minimal starter)

This repository contains a minimal, freshman-friendly starter layout so you can run a working app with:

- `frontend/` — simple static frontend files (HTML/CSS/JS)
- `backend/` — minimal Node/Express server that serves the frontend and a tiny API
- `databases/` — placeholder SQL files (migrations/seed) kept here

Quick start (from repo root):

1. Install Node dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open http://localhost:3000 in your browser. The page will call `/api/status` to confirm the backend is reachable.

This intentionally does just enough to be connected and get you started. Below are updated instructions to run the React frontend and the Python FastAPI backend separately.

Frontend (React + Vite)

1. Open a terminal and change into the frontend folder:

```bash
cd frontend
npm install
npm run dev
```

The dev server will usually start on http://localhost:5173 and the React app will call the backend at `/api/status`.

Backend (FastAPI)

1. Create and activate a Python virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Start the backend:

```bash
uvicorn backend.app:app --reload --port 8000
```

The backend will be available at http://localhost:8000 and exposes `/api/status` and `/api/members`.

Notes for freshmen/sophomores

- Run frontend and backend in separate terminals (one for the React dev server, one for the Python backend). This keeps development simple and makes hot reload work.
- CORS is already configured in `backend/app.py` to allow the Vite dev server.
- Once you're comfortable, we can add a single script to start both servers concurrently.