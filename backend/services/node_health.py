"""
services/node_health.py

Background service that polls all registered KVM nodes periodically to verify
their availability and updates the `status` and `last_seen_at` fields in the DB.
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from core.config import settings
from db.session import AsyncSessionLocal
from models.kvm_node import KvmNode
from schemas.kvm_node import NodeStatus

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
        """Ping a single node's MediaMTX WHEP port and update its status."""

        # Check if the WebRTC streaming port is open and responding.
        # Since the API port (9997) is closed on the user's Pi, we ping port 8889.
        url = f"http://{node.internal_ip}:8889/{node.stream_name}/whep"

        is_online = False
        try:
            async with httpx.AsyncClient(
                timeout=settings.NODE_HTTP_TIMEOUT_SECONDS
            ) as client:
                # Use OPTIONS as a lightweight ping that asks the server what methods are allowed
                response = await client.options(url)
                # MediaMTX might return 200, 204 or 405 Method Not Allowed. Any response means alive.
                if response.status_code in (200, 204, 400, 401, 403, 404, 405):
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
