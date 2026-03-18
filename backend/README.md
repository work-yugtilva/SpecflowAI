# SpecFlow Backend API

RESTful API server for SpecFlow, built with Express.js and TypeScript.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Fill in your environment variables.

3. **Run in development:**
   ```bash
   npm run dev
   ```
   Server will run on `http://localhost:3001`

## API Endpoints

### Context
- `GET /api/context` - Get user's context
- `POST /api/context` - Save/update context
- `DELETE /api/context` - Delete context

### Research
- `GET /api/research` - List research entries
- `POST /api/research` - Create research entry
- `GET /api/research/:id` - Get specific entry
- `PUT /api/research/:id` - Update entry
- `DELETE /api/research/:id` - Delete entry
- `GET /api/research/search?q=query` - Search entries

### Health
- `GET /health` - API health check
- `GET /` - API info

## Authentication

All endpoints except `/health` and `/` require a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/context
```

Tokens are obtained from Supabase authentication.

## Project Structure

```
/src
  /middleware     - Express middleware (auth, error handling)
  /routes         - API route handlers
  /services       - Business logic layer
  /types          - TypeScript type definitions
  /utils          - Utility functions
  index.ts        - Main Express app
```

## Database Integration (TODO)

Services are structured to integrate with Supabase tables. Currently, they log operations but don't persist data. To complete:

1. Create Supabase tables for `context`, `research`, etc.
2. Implement database queries in service methods
3. Add proper validation and error handling

## Development

- `npm run dev` - Start dev server with auto-reload
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled server
- `npm run type-check` - Check TypeScript types
- `npm run lint` - Run ESLint

## Environment Variables

See `.env.example` for required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin access)
- `FRONTEND_URL` - Frontend origin for CORS
- `PORT` - Server port (default: 3001)
