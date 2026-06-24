# Distributed Real-Time Interview Platform

## Full Stack Docker Deployment

1. Create `backend/.env` from `backend/.env.example` and fill in your real secrets.
2. Optionally create a root `.env` from `.env.example` to customize the public frontend URL or host port.
3. Start the full stack from the repo root:

```bash
docker compose up --build
```

Default URLs:
- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:8080/health`
- Direct backend access: `http://localhost:3001`

Notes:
- Docker Compose automatically points the backend container at the bundled Postgres service, so your host-only `localhost` database URL does not need to be changed inside `backend/.env`.
- Prisma migrations run automatically when the backend container starts.
- The backend image installs `python3` because the `/code/run` and `/code/run-tests` endpoints execute Python submissions.
- The frontend container serves the Vite build through Nginx and proxies `/auth`, `/rooms`, `/code`, `/ai`, `/health`, and `/socket.io` to the backend container.
- For a real deployment, set `PUBLIC_FRONTEND_URL=https://your-domain.com` in the root `.env` so backend-generated reset links and CORS align with your public app URL.
- If you start the backend image outside Docker Compose, you must pass a container-reachable `DATABASE_URL`.
