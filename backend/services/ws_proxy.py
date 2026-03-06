"""
services/ws_proxy.py

Bidirectional asynchronous WebSocket proxy between the browser client and the
Raspberry Pi control server.

Security model
--------------
1. The browser connects to the Control Plane WebSocket endpoint (over TLS via Caddy).
2. The JWT access token is passed as a query parameter ``?token=<access_token>``
   (Authorization headers cannot be set on WebSocket connections in most browsers).
3. The Control Plane validates the token and checks node permission BEFORE opening
   the upstream connection to the RPi.  The client never sees the RPi's internal
   IP address or port.
4. If validation fails the WS connection is closed immediately with a 4001 or 4003
   close code (application-level codes above 4000 are reserved for application use).

Data flow
---------
Browser  <──[WS]──>  Control Plane  <──[WS]──>  RPi ws://internal-ip:8080/ws/control
               (tunnel)                   (LAN/tunnel, no TLS required)

Forwarding strategy
-------------------
Two asyncio Tasks run concurrently:
    _forward_client_to_node   : client → proxy → RPi
    _forward_node_to_client   : RPi → proxy → client

When either direction closes/errors the other Task is cancelled and both
connections are closed cleanly.

WebSocket close codes used
--------------------------
    4001  Authentication failed (bad / expired token)
    4003  Authorisation denied (no can_control permission)
    4004  KVM node not found in database
    4005  Upstream (RPi) connection failed
    1000  Normal closure (either side closed gracefully)
"""

import asyncio
import logging
import uuid

import websockets
import websockets.exceptions
from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import verify_token
from models.kvm_node import KvmNode
from models.user import User
from models.user_node_permission import UserNodePermission

logger = logging.getLogger(__name__)

# Application-level WS close codes (4000–4999 are reserved for apps by RFC 6455)
_CODE_AUTH_FAILED = 4001
_CODE_AUTH_DENIED = 4003
_CODE_NODE_NOT_FOUND = 4004
_CODE_UPSTREAM_FAILED = 4005


class WebSocketProxyService:
    """Validates access and bridges a browser WebSocket to a Raspberry Pi node.

    Each KVM node runs a local WebSocket server (default: port 8080) that
    accepts keyboard/mouse command messages.  This service:
        - validates the client's JWT
        - checks the user_node_permissions table for ``can_control`` access
        - opens a WebSocket connection to the RPi's private address
        - bidirectionally forwards all messages until one side disconnects

    Usage (from the API router)
    ---------------------------
        service = WebSocketProxyService()
        await service.proxy(websocket, node, db)
    """

    async def proxy(
        self,
        client_ws: WebSocket,
        token: str,
        node_id_str: str,
        db: AsyncSession,
    ) -> None:
        """Entry point: authenticate, authorise, then start the proxy bridge.

        Parameters
        ----------
        client_ws:
            The FastAPI WebSocket object representing the browser connection.
            This method accepts the connection only after validation succeeds,
            so that rejected clients receive a protocol-level close frame.
        token:
            Raw JWT access token extracted from the ``?token=`` query parameter.
        node_id_str:
            UUID of the KVM node as a string (from the URL path parameter).
        db:
            Async SQLAlchemy session for permission lookups.
        """
        # ------------------------------------------------------------------
        # Step 1 — Validate JWT
        # ------------------------------------------------------------------
        try:
            payload = verify_token(token, expected_type="access")
        except JWTError as exc:
            logger.warning("WS proxy: token validation failed — %s", exc)
            await client_ws.close(
                code=_CODE_AUTH_FAILED, reason="Invalid or expired token."
            )
            return

        # ------------------------------------------------------------------
        # Step 2 — Resolve the User from DB
        # ------------------------------------------------------------------
        user = await self._get_user(db, payload.sub)
        if user is None or not user.is_active:
            logger.warning("WS proxy: user not found or inactive (sub=%s)", payload.sub)
            await client_ws.close(code=_CODE_AUTH_FAILED, reason="User not found.")
            return

        # ------------------------------------------------------------------
        # Step 3 — Resolve the KVM Node
        # ------------------------------------------------------------------
        try:
            node_uuid = uuid.UUID(node_id_str)
        except ValueError:
            await client_ws.close(code=_CODE_NODE_NOT_FOUND, reason="Invalid node ID.")
            return

        node = await self._get_node(db, node_uuid)
        if node is None:
            logger.warning("WS proxy: node not found (id=%s)", node_id_str)
            await client_ws.close(
                code=_CODE_NODE_NOT_FOUND, reason="KVM node not found."
            )
            return

        # ------------------------------------------------------------------
        # Step 4 — Check can_control permission (superusers bypass)
        # ------------------------------------------------------------------
        if not user.is_superuser:
            allowed = await self._check_control_permission(db, user.id, node.id)
            if not allowed:
                logger.warning(
                    "WS proxy: user '%s' denied control of node '%s'",
                    user.username,
                    node.name,
                )
                await client_ws.close(
                    code=_CODE_AUTH_DENIED,
                    reason="You are not allowed to control this node.",
                )
                return

        # ------------------------------------------------------------------
        # Step 5 — Accept the browser WebSocket and open upstream connection
        # ------------------------------------------------------------------
        await client_ws.accept()

        upstream_uri = f"ws://{node.internal_ip}:{node.ws_port}/ws/control"
        logger.info(
            "WS proxy: user '%s' connecting to node '%s' at %s",
            user.username,
            node.name,
            upstream_uri,
        )

        try:
            async with websockets.connect(upstream_uri) as upstream_ws:
                logger.info(
                    "WS proxy: upstream connection established → %s", upstream_uri
                )
                await self._bridge(client_ws, upstream_ws)
        except (OSError, websockets.exceptions.WebSocketException) as exc:
            logger.error(
                "WS proxy: upstream connection to %s failed — %s", upstream_uri, exc
            )
            # The client WS was already accepted; close it with an error code
            try:
                await client_ws.close(
                    code=_CODE_UPSTREAM_FAILED,
                    reason="Could not connect to KVM node.",
                )
            except Exception:
                pass  # client may have already disconnected
        except WebSocketDisconnect:
            logger.info("WS proxy: client disconnected (normal closure).")
        finally:
            logger.info(
                "WS proxy: session ended for user '%s' on node '%s'.",
                user.username,
                node.name,
            )

    # ------------------------------------------------------------------
    # Bidirectional bridge
    # ------------------------------------------------------------------
    async def _bridge(
        self,
        client_ws: WebSocket,
        upstream_ws: websockets.WebSocketClientProtocol,
    ) -> None:
        """Run two concurrent forwarding tasks until either side closes.

        The first task to finish triggers cancellation of the other,
        ensuring both connections are cleaned up without leaving orphaned tasks.
        """
        client_to_node_task = asyncio.create_task(
            self._forward_client_to_node(client_ws, upstream_ws),
            name="client→node",
        )
        node_to_client_task = asyncio.create_task(
            self._forward_node_to_client(upstream_ws, client_ws),
            name="node→client",
        )

        # Wait for whichever direction closes/errors first
        done, pending = await asyncio.wait(
            {client_to_node_task, node_to_client_task},
            return_when=asyncio.FIRST_COMPLETED,
        )

        # Cancel the remaining task and wait for it to finish
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Re-raise any exception from the completed task (for logging upstream)
        for task in done:
            exc = task.exception()
            if exc is not None:
                logger.debug(
                    "WS proxy bridge: task '%s' raised: %s", task.get_name(), exc
                )

    async def _forward_client_to_node(
        self,
        client_ws: WebSocket,
        upstream_ws: websockets.WebSocketClientProtocol,
    ) -> None:
        """Relay messages from the browser client to the RPi control server.

        Messages from the browser are keyboard/mouse command JSON payloads.
        Both text and binary frames are supported for future flexibility.
        """
        try:
            while True:
                # receive_text() / receive_bytes() raise WebSocketDisconnect on close
                try:
                    message = await client_ws.receive_text()
                    await upstream_ws.send(message)
                except WebSocketDisconnect:
                    logger.debug("WS proxy: client closed connection (client→node).")
                    break
        except websockets.exceptions.ConnectionClosed:
            logger.debug("WS proxy: upstream closed while forwarding client→node.")

    async def _forward_node_to_client(
        self,
        upstream_ws: websockets.WebSocketClientProtocol,
        client_ws: WebSocket,
    ) -> None:
        """Relay messages from the RPi control server back to the browser client.

        The RPi may send status acknowledgements or error messages.
        """
        try:
            async for message in upstream_ws:
                try:
                    if isinstance(message, bytes):
                        await client_ws.send_bytes(message)
                    else:
                        await client_ws.send_text(message)
                except WebSocketDisconnect:
                    logger.debug(
                        "WS proxy: client closed while forwarding node→client."
                    )
                    break
        except websockets.exceptions.ConnectionClosed:
            logger.debug("WS proxy: upstream closed connection (node→client).")

    # ------------------------------------------------------------------
    # Private DB helpers (keep queries co-located with the service)
    # ------------------------------------------------------------------
    @staticmethod
    async def _get_user(db: AsyncSession, user_id_str: str) -> User | None:
        """Fetch a User by UUID string; return None if not found."""
        try:
            uid = uuid.UUID(user_id_str)
        except ValueError:
            return None
        result = await db.execute(select(User).where(User.id == uid))
        return result.scalars().first()

    @staticmethod
    async def _get_node(db: AsyncSession, node_id: uuid.UUID) -> KvmNode | None:
        """Fetch a KvmNode by UUID; return None if not found."""
        result = await db.execute(select(KvmNode).where(KvmNode.id == node_id))
        return result.scalars().first()

    @staticmethod
    async def _check_control_permission(
        db: AsyncSession,
        user_id,
        node_id,
    ) -> bool:
        """Return True if the user has ``can_control=True`` for this node."""
        result = await db.execute(
            select(UserNodePermission).where(
                UserNodePermission.user_id == user_id,
                UserNodePermission.node_id == node_id,
                UserNodePermission.can_control.is_(True),
            )
        )
        return result.scalars().first() is not None
