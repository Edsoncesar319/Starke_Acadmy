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

### Upload de vídeo

Na Vercel, vídeos usam **upload direto ao Blob** (`@vercel/blob/client` + `api/blob-client-upload`), sem passar pelo backend Python.  
Conecte o **Blob** no painel, defina `BLOB_READ_WRITE_TOKEN` e `AUTH_SECRET_KEY`. Arquivos até **100 MB** (MP4, WEBM, MOV).  
URLs públicas do Blob vão direto à CDN (`blobVideoAccess: 'public'`). Faça login de novo após deploy (claim JWT `cm`).

Em desenvolvimento local, o padrão é upload pelo backend; ative `useBlobClientUpload` e Blob local para testar o fluxo direto.

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
| Admin | `admin@starke.academy` | *(definida no deploy / seed)* |

## Build

```bash
cd frontend
npm run build
```

Saída em `public/` na raiz do repositório (CDN da Vercel). Cópia espelhada em `backend/app/public/`.

## Deploy manual

Na raiz do repositório:

```bash
vercel deploy --prod
```

O build roda `backend/scripts/vercel_build.py` (Angular → `public/` + FastAPI em `/api`).

Se a home mostrar JSON em vez do portal, o build não chegou na Vercel. Rode localmente `python backend/scripts/vercel_build.py`, commite as pastas `public/` e `backend/app/public/`, e faça push.

Se o deploy falhar com exit code 1, confira nos logs da Vercel:
- Node.js 20 ativo no projeto (ou `.nvmrc` na raiz)
- `frontend/package-lock.json` commitado junto com `package.json`
- Erros do `ng build` (TypeScript / memória)
