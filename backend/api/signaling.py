"""
api/signaling.py

WebRTC signaling router — relays SDP offers from the browser to the MediaMTX
instance running on the Raspberry Pi, and returns the SDP answer.

Endpoints
---------
    POST /api/v1/nodes/{node_id}/signal/offer  — forward SDP offer to MediaMTX
    POST /api/v1/nodes/{node_id}/signal/answer — accept SDP answer (future use)

Network flow
-------------
    Browser ──[SDP offer]──> Control Plane ──[HTTP POST /whep]──> MediaMTX on RPi
    Browser <──[SDP answer]── Control Plane <──[HTTP 201]────────── MediaMTX on RPi

Because the RPi and Control Plane share a VPN tunnel no external STUN/TURN
servers are needed.  MediaMTX auto-selects host ICE candidates on the tunnel
interface.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
import httpx

from core.config import settings
from core.dependencies import require_node_access
from models.kvm_node import KvmNode
from schemas.signaling import ICECandidate, SDPAnswer, SDPOffer
from services.node_url import get_node_http_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signaling"])

# MediaMTX WHEP endpoint path (WebRTC HTTP Egress Protocol)
_MEDIAMTX_WHEP_PATH = "/whep/index.mpd"


@router.post(
    "/nodes/{node_id}/signal/offer",
    response_model=SDPAnswer,
    summary="Relay a WebRTC SDP offer to the node's MediaMTX and return the answer.",
)
async def signal_offer(
    offer: SDPOffer,
    node: Annotated[KvmNode, Depends(require_node_access())],
) -> SDPAnswer:
    """Forward an SDP offer to MediaMTX (WHEP) and return the SDP answer.

    The browser should call this endpoint with the output of
    ``RTCPeerConnection.createOffer()`` to initiate video streaming.
    """
    # Build the WHEP URL via the centralised URL helper
    mediamtx_url = get_node_http_url(node)
    logger.info("Relaying SDP offer to node '%s' at %s", node.name, mediamtx_url)

    async with httpx.AsyncClient(timeout=settings.NODE_HTTP_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                mediamtx_url,
                content=offer.sdp,
                headers={"Content-Type": "application/sdp"},
            )
            response.raise_for_status()
        except httpx.RequestError as exc:
            logger.error("SDP relay: request to %s failed — %s", mediamtx_url, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach the KVM node's streaming server.",
            )
        except httpx.HTTPStatusError as exc:
            logger.error(
                "SDP relay: MediaMTX returned HTTP %d", exc.response.status_code
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"MediaMTX error: HTTP {exc.response.status_code}",
            )

    return SDPAnswer(sdp=response.text, type="answer")


@router.post(
    "/nodes/{node_id}/signal/ice",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Submit a trickle ICE candidate (not required for host-only networks).",
)
async def signal_ice(
    candidate: ICECandidate,
    _node: Annotated[KvmNode, Depends(require_node_access())],
) -> None:
    """Stub endpoint for trickle ICE candidate exchange.

    On private VPN/tunnel networks, host candidates are sufficient and trickle
    ICE is not required.  This endpoint is kept for spec-compliance and future
    internet-facing deployments where ICE trickling improves connection speed.
    """
    logger.debug(
        "ICE candidate received (no-op in host-only mode): %s", candidate.candidate
    )
    return
