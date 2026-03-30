# SpecflowAI

SpecFlow uses a single repo-root env file for the frontend, Express API, and FastAPI pipeline service.

Canonical setup instructions live in [docs/setup.md](./docs/setup.md).

Quick start:

```bash
cp .env.example .env
npm install
npm install --prefix frontend
npm install --prefix backend
python3 -m pip install -r backend/requirements.txt
npm run dev
```

Local ports:
- frontend: `http://localhost:3000`
- express api: `http://localhost:3001`
- pipeline api: `http://localhost:8001`
