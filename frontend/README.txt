Canteen Booking - Frontend
==========================

A mobile-first React (Vite) frontend for the Canteen Booking System backend.

Prerequisites
-------------
- Node.js 20+ (tested on Node 22)
- npm
- The FastAPI backend running on http://localhost:8000
  (or set VITE_API_BASE_URL to point elsewhere)

Setup
-----
  cd frontend
  npm install

Run locally
-----------
  npm run dev
  -> http://localhost:5173

Build for production
--------------------
  npm run build

Preview the production build
----------------------------
  npm run preview

Environment
-----------
See .env.example for available variables. Copy it to .env to override:

  cp .env.example .env

The only variable typically changed is VITE_API_BASE_URL:

  VITE_API_BASE_URL=http://localhost:8000

Configuration
-------------
- Vite config is in vite.config.js (React plugin, dev server on port 5173).
- The backend CORS already allows http://localhost:5173.
- The built-in axios client automatically attaches the JWT Bearer token
  to every request and redirects to /login on 401.
