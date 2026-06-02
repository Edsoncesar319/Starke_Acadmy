# Starke Academy Elite Portal

Angular 17 + FastAPI. Em produção, frontend e API rodam no mesmo domínio Vercel.

## Produção

- **Site:** https://starke-acadmy.vercel.app  
- **API:** https://starke-acadmy.vercel.app/api  
- **Health:** https://starke-acadmy.vercel.app/api/health  

### Variáveis na Vercel (recomendado)

1. [Projeto → Settings → Storage](https://vercel.com) → **Postgres** → conectar ao `starke-acadmy`  
2. **Blob** → criar store e conectar  
3. **Environment Variables** → adicionar `AUTH_SECRET_KEY` (string aleatória longa)  
4. Redeploy após conectar o storage  

Sem Postgres, a API usa SQLite em `/tmp` (dados podem sumir entre deploys).

## Desenvolvimento local

Dois terminais.

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

- API: `http://127.0.0.1:8000/api`  
- Health: `http://127.0.0.1:8000/api/health`  

### Frontend

```bash
cd frontend
npm install
npm start
```

- App: `http://localhost:4200`  

## Login (seed)

| Perfil | Email | Senha |
|--------|-------|-------|
| Aluno | `evelyn@starke.academy` | `elite123` |
| Admin | `admin@starke.academy` | `admin123` |

## Build

```bash
cd frontend
npm run build
```

Saída em `public/` (usado no deploy Vercel).

## Deploy manual

Na raiz do repositório:

```bash
vercel deploy --prod
```

O build roda `backend/scripts/vercel_build.py` (Angular → `public/` + FastAPI).
