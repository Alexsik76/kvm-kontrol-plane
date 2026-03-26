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

    async with httpx.AsyncClient(timeout=settings.NODE_HTTP_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                mediamtx_url,
                content=offer.sdp,
                headers={"Content-Type": "application/sdp"},
            )
            response.raise_for_status()
            
            # WHEP specification: The session URL is returned in the 'Location' header.
            # We must use this URL for subsequent ICE candidates (PATCH).
            session_url = response.headers.get("Location")
            if session_url and session_url.startswith("/"):
                parsed_base = urlparse(mediamtx_url)
                session_url = f"{parsed_base.scheme}://{parsed_base.netloc}{session_url}"
            
            return SDPAnswer(sdp=response.text, type="answer", session_url=session_url)
        except Exception as exc:
            logger.error("Signaling offer failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach the KVM node's streaming server.",
            )

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
    # Use the session_url provided by the frontend, or fallback to the node's base URL
    target_url = candidate.session_url or get_node_http_url(node)
    
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            # WHEP protocol: trickle ICE candidates are sent via PATCH
            await client.patch(
                target_url,
                content=candidate.candidate,
                headers={"Content-Type": "application/trickle-ice-sdpfrag"}
            )
        except Exception as exc:
            logger.warning("Failed to forward ICE candidate to %s: %s", target_url, exc)
    return
