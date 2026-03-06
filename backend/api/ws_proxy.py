"""
api/ws_proxy.py

WebSocket proxy endpoint — the single gateway through which browser clients
send keyboard/mouse commands to a Raspberry Pi KVM node.

The actual proxy logic lives in services/ws_proxy.py (SRP); this module only
handles the HTTP→WebSocket upgrade and wires the FastAPI Depends context.

Token transport
---------------
Browser WebSocket clients cannot set the ``Authorization`` header.  The JWT
access token is therefore passed as a query parameter:
    wss://kvm.local/api/v1/nodes/{id}/ws?token=<access_token>

The WebSocketProxyService validates the token before accepting the WS
connection so unauthenticated clients receive a close frame with code 4001
instead of being accepted and immediately dropped.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from services.ws_proxy import WebSocketProxyService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws-proxy"])

# Module-level service instance (stateless — safe to share across connections)
_proxy_service = WebSocketProxyService()


@router.websocket("/nodes/{node_id}/ws")
async def websocket_proxy(
    websocket: WebSocket,
    node_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    token: str = Query(..., description="JWT access token (Bearer value)."),
) -> None:
    """Bidirectional WebSocket proxy between the browser and the RPi control server.

    Authentication and authorisation are performed inside the service before
    the connection is accepted, so rejected clients see a clean close frame.

    Parameters
    ----------
    websocket:
        The incoming WebSocket connection from the browser.
    node_id:
        UUID of the target KVM node (path parameter).
    db:
        Async DB session for token/permission validation.
    token:
        JWT access token passed as ``?token=<value>`` query parameter.
    """
    logger.info("WS upgrade request: node_id=%s", node_id)
    await _proxy_service.proxy(
        client_ws=websocket,
        token=token,
        node_id_str=node_id,
        db=db,
    )
