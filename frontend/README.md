# Starke Academy Elite Portal

Frontend in Angular 17 (Signals + Standalone + Tailwind) with backend in FastAPI + SQLite.

## Run the application

Open two terminals.

### 1) Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Backend URL: `http://127.0.0.1:8000`  
Health check: `http://127.0.0.1:8000/health`

### 2) Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

Frontend URL: `http://localhost:4200`

## Login (seed user)

- Email: `evelyn@starke.academy`
- Password: `elite123`

## Useful commands

### Frontend

```bash
cd frontend
npm run build
```

### Backend

```bash
cd backend
.\.venv\Scripts\python -c "from app.main import app; print(app.title)"
```

## Notes

- If backend dependency install fails with bcrypt/passlib conflict, ensure `bcrypt==4.0.1` is present in `backend/requirements.txt`.
- Start backend first, then frontend.
