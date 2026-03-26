"""
api/signaling.py

WebRTC signaling router — relays SDP offers and ICE candidates from the browser 
to the MediaMTX instance running on the Raspberry Pi.
"""

import logging
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
import httpx

from core.config import settings
from core.dependencies import require_node_access
from models.kvm_node import KvmNode
from schemas.signaling import ICECandidate, SDPAnswer, SDPOffer
from services.node_url import get_node_http_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signaling"])

@router.post(
    "/nodes/{node_id}/signal/offer",
    response_model=SDPAnswer,
    summary="Relay a WebRTC SDP offer to the node's MediaMTX and return the answer.",
)
async def signal_offer(
    offer: SDPOffer,
    node: Annotated[KvmNode, Depends(require_node_access())],
) -> SDPAnswer:
    """Forward an SDP offer to MediaMTX (WHEP) and return the SDP answer."""
    try:
        mediamtx_url = get_node_http_url(node)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error building node URL",
        )

    # Use a longer timeout for the initial handshake
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                mediamtx_url,
                content=offer.sdp,
                headers={"Content-Type": "application/sdp"},
            )
            
            if response.status_code not in (200, 201):
                logger.error("MediaMTX returned error %s for URL %s: %s", response.status_code, mediamtx_url, response.text)
                raise HTTPException(status_code=502, detail="Streaming server rejected the offer")

            # Extract session URL from Location header (critical for Trickle ICE)
            session_path = response.headers.get("Location")
            session_url = None
            if session_path:
                if session_path.startswith("http"):
                    session_url = session_path
                else:
                    parsed_base = urlparse(mediamtx_url)
                    session_url = f"{parsed_base.scheme}://{parsed_base.netloc}{session_path}"
            
            return SDPAnswer(sdp=response.text, type="answer", session_url=session_url)
        except httpx.RequestError as exc:
            logger.error("Network error connecting to node %s at %s: %s", node.id, mediamtx_url, exc)
            raise HTTPException(status_code=502, detail="KVM Node unreachable via tunnel")

@router.post(
    "/nodes/{node_id}/signal/ice",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Submit a trickle ICE candidate to the node's MediaMTX session.",
)
async def signal_ice(
    candidate: ICECandidate,
    node: Annotated[KvmNode, Depends(require_node_access())],
) -> None:
    """Forward a trickle ICE candidate to the specific WHEP session URL."""
    # Front-end provides the session_url it received from the offer
    target_url = candidate.session_url or get_node_http_url(node)
    
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            # MediaMTX WHEP implementation uses PATCH for ICE candidates
            await client.patch(
                target_url,
                content=candidate.candidate,
                headers={"Content-Type": "application/trickle-ice-sdpfrag"}
            )
        except Exception as exc:
            logger.warning("Failed to forward ICE candidate to %s: %s", target_url, exc)
    return
