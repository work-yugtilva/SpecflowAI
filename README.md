# SpecflowAI

SpecFlowAI uses a single repo-root env file for both the frontend and backend.

## Setup

1. Copy the shared env template:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   npm install --prefix frontend
   npm install --prefix backend
   ```
3. Start the app:
   ```bash
   npm run dev
   ```

`frontend/.env.local` and `backend/.env` are no longer used.
