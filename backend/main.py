"""
main.py

IP-KVM Control Plane — FastAPI application entry point.

Responsibilities of this module (and ONLY these — SRP):
    1. Create and configure the FastAPI app instance.
    2. Register all API routers under the /api/v1 prefix.
    3. Configure CORS middleware.
    4. Define the lifespan context: start/stop the node health-check background task.
    5. Expose a /healthz liveness probe (no auth required).

Everything else (business logic, DB access, JWT operations) lives in
dedicated sub-packages: core/, services/, api/, db/, models/.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import auth as auth_router
from api import kvm_nodes as kvm_nodes_router
from api import signaling as signaling_router
from api import ws_proxy as ws_proxy_router
from core.config import settings
from services.node_health import NodeHealthService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown events.

    Startup:
        - Launch the NodeHealthService background task that periodically
          polls all registered KVM nodes and updates their status in the DB.

    Shutdown:
        - Cancel the health-check task and wait for it to finish cleanly.
    """
    logger.info("Starting IP-KVM Control Plane v%s …", settings.APP_VERSION)

    # Start the health-check poller as a background asyncio task
    health_service = NodeHealthService()
    poller_task: asyncio.Task = asyncio.create_task(
        health_service.run_poller(),
        name="node-health-poller",
    )

    try:
        yield  # ← application serves requests here
    finally:
        logger.info("Shutting down — cancelling health poller …")
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass
        logger.info("IP-KVM Control Plane shut down cleanly.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "Control Plane API for IP-KVM hardware nodes. "
        "Provides secure WebSocket proxying, WebRTC signaling relay, "
        "and node management."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.lab\.vn\.ua",  # Allow any subdomain of lab.vn.ua
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
_API_PREFIX = settings.API_V1_PREFIX

app.include_router(auth_router.router, prefix=_API_PREFIX)
app.include_router(kvm_nodes_router.router, prefix=_API_PREFIX)
# signaling and ws_proxy use /nodes/{id}/... paths — include at root prefix
app.include_router(signaling_router.router, prefix=_API_PREFIX)
app.include_router(ws_proxy_router.router, prefix=_API_PREFIX)


# ---------------------------------------------------------------------------
# Liveness probe — no authentication required
# ---------------------------------------------------------------------------
@app.get("/healthz", tags=["infrastructure"], summary="Liveness probe.")
async def healthz() -> dict:
    """Return 200 OK to signal the application is running.

    Used by Docker HEALTHCHECK, Caddy, and external monitoring tools.
    Does NOT check database connectivity (use /readyz for that in future).
    """
    return {"status": "ok", "version": settings.APP_VERSION}
