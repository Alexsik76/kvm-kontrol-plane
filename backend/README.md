# KVM Control Plane - Backend Service

This is the central REST API backend service for the IP-KVM Control Plane. It manages KVM nodes, provides JWT authentication, handles WebRTC signaling requests, and monitors node health status.

## Tech Stack

- **Language**: Python 3.10+
- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM & Migrations**: SQLAlchemy & Alembic
- **Validation**: Pydantic
- **Testing**: Pytest
- **Containerization**: Docker & Docker Compose

## Directory Structure

- `api/` — API route handlers and endpoints
- `core/` — Application configuration, security, and authentication utilities
- `db/` — Database session and connection setup
- `models/` — SQLAlchemy database models
- `schemas/` — Pydantic request and response schemas
- `services/` — Core business logic (node health poller, signaling)
- `alembic/` — Database migration scripts
- `docs/` — Documentation (including API reference)
- `main.py` — Application entry point

## Setup and Running

### Environment Variables

Copy the example environment file to create your local config:

```bash
cp .env.example .env
```

### Running with Docker Compose

Start the backend and database containers:

```bash
docker compose up -d
```

Apply database migrations after starting the service:

```bash
docker compose exec backend alembic upgrade head
```

The API will be accessible at `http://localhost:8000`.

## Running Tests

To run the test suite with `pytest`:

```bash
docker compose exec backend pytest
```

Or locally inside a virtual environment:

```bash
pytest
```

## API Documentation

Detailed endpoint specifications, request formats, and response schemas are available in [docs/API.md](docs/API.md).
