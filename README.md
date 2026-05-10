# COM769 Coursework 2 — PhotoShare (cloud-native photo sharing)

This repository contains a scalable, cloud-native, Instagram-like **photo sharing** web application with:

- **Creator users**: can upload photos and set metadata (title, caption, location, people).
- **Consumer users**: can browse/search photos, view details, comment, and rate.
- **REST API backend** + **static frontend**.
- **Persistence**: Postgres for relational data + S3-compatible object storage for media.
- **Scalability features**: Redis caching, stateless API container, CDN-friendly static frontend.
- **Advanced features** (for coursework marks): identity/roles, CI pipeline, media thumbnail generation.

## Repo structure

- `backend/`: Node.js REST API (TypeScript, Fastify)
- `frontend/`: Static SPA (Vite + React)
- `docker-compose.yml`: local cloud-like stack (Postgres + Redis + MinIO + API + Web)

## Quickstart (local)

Prereqs: Docker Desktop.

If `docker compose` says it **cannot connect to the Docker daemon**, start Docker Desktop first and wait until it shows “Docker Engine running”.

1. Copy env templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Start everything:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:5173`
- Frontend: `http://localhost:5173`
- API: `http://localhost:3001/health`
- MinIO console: `http://localhost:9001`

## Default accounts (local)

There is **no public creator enrolment UI** (per spec). Use the seeded accounts:

- Creator:
  - email: `creator@example.com`
  - password: `Password123!`
- Consumer:
  - email: `consumer@example.com`
  - password: `Password123!`

## API docs

Once running, OpenAPI is available at:

- `http://localhost:3000/docs`
- `http://localhost:3001/docs`