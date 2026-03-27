"""
services/node_health.py

Background service that polls all registered KVM nodes periodically to verify
their availability and updates the `status` and `last_seen_at` fields in the DB.
"""

import asyncio
import logging
import base64
from datetime import datetime, timezone

import httpx
from sqlmodel import select

from core.config import settings
from db.session import AsyncSessionLocal
from models.kvm_node import KvmNode
from schemas.kvm_node import NodeStatus
from services.node_url import get_node_http_url

logger = logging.getLogger(__name__)


class NodeHealthService:
    """Background task runner for KVM node health checking."""

    async def run_poller(self) -> None:
        """Main loop: wakes up every N seconds, checks all nodes, updates DB."""
        logger.info("NodeHealthService poller started.")
        while True:
            try:
                await self._check_all_nodes()
            except asyncio.CancelledError:
                logger.info("NodeHealthService poller cancelled.")
                raise
            except Exception as e:
                logger.error("Unexpected error in health poller: %s", e)

            await asyncio.sleep(settings.NODE_POLL_INTERVAL_SECONDS)

    async def _check_all_nodes(self) -> None:
        """Fetch all nodes from the database and check their health concurrently."""
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(KvmNode))
            nodes = result.scalars().all()

            if not nodes:
                return

            tasks = [self._check_node(db, node) for node in nodes]
            await asyncio.gather(*tasks)

            # Commit all status updates to the database
            await db.commit()

    async def _check_node(self, db, node: KvmNode) -> None:
        """Ping a single node's MediaMTX WHEP endpoint and update its status.

        Uses get_node_http_url() which prefers the Cloudflare Tunnel URL over
        the legacy internal_ip:port scheme when tunnel_url is configured.
        """
        # Build the WHEP URL via the centralised URL helper
        url = get_node_http_url(node)

        is_online = False
        headers = {}
        if node.mediamtx_user and node.mediamtx_pass:
            auth_str = f"{node.mediamtx_user}:{node.mediamtx_pass}"
            encoded_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
            headers["Authorization"] = f"Basic {encoded_auth}"

        try:
            async with httpx.AsyncClient(
                timeout=settings.NODE_HTTP_TIMEOUT_SECONDS
            ) as client:
                # Use OPTIONS as a lightweight ping that asks the server what methods are allowed
                response = await client.options(url, headers=headers)
                # MediaMTX might return 200, 204 or 405 Method Not Allowed.
                # A 404 means the stream path or WHEP itself is missing.
                if response.status_code in (200, 204, 401, 403, 405):
                    is_online = True
        except httpx.RequestError:
            pass  # Node is offline/unreachable
        except Exception as e:
            logger.debug("Node %s health check failed: %s", node.name, e)

        # Update the node model
        previous_status = node.status
        if is_online:
            node.status = NodeStatus.ONLINE
            node.last_seen_at = datetime.now(timezone.utc)
        else:
            node.status = NodeStatus.OFFLINE

        # Log state changes
        if previous_status != node.status:
            logger.info(
                "Node '%s' (%s) transitioned from %s to %s",
                node.name,
                node.internal_ip,
                previous_status.value,
                node.status.value,
            )
