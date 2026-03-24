"""
services/node_url.py

Centralised helpers for building backend→RPi URLs.

Priority rule
-------------
1. node.tunnel_url (Cloudflare Tunnel HTTPS address, e.g. "https://pi4.lab.vn.ua")
2. settings.NODE_DEFAULT_TUNNEL_URL           (global fallback tunnel from .env)
3. Legacy direct address: http://{node.internal_ip}:{port}

This single module is the only place that knows about the URL construction
strategy, keeping node_health.py and ws_proxy.py free of URL logic.
"""

from __future__ import annotations

from models.kvm_node import KvmNode
from core.config import settings


def _effective_base_url(node: KvmNode) -> str | None:
    """Return the best HTTPS base URL for this node, or None if not configured."""
    if node.tunnel_url and node.tunnel_url.strip():
        return node.tunnel_url.rstrip("/")
    if settings.NODE_DEFAULT_TUNNEL_URL and settings.NODE_DEFAULT_TUNNEL_URL.strip():
        return settings.NODE_DEFAULT_TUNNEL_URL.rstrip("/")
    return None


def get_node_http_url(node: KvmNode) -> str:
    """Build the HTTPS URL for MediaMTX WHEP health-check endpoint.

    Used by NodeHealthService to probe node availability.

    Examples
    --------
    Tunnel configured  → https://pi4.lab.vn.ua/kvm/whep
    No tunnel          → http://10.8.0.10:8889/kvm/whep
    """
    base = _effective_base_url(node)
    if base:
        return f"{base}/{node.stream_name}/whep"
    return f"http://{node.internal_ip}:8889/{node.stream_name}/whep"


def get_node_control_url(node: KvmNode) -> str:
    """Build the HTTP URL for the RPi control server (hid_server).

    Used for non-WebSocket control actions like /wake.

    Examples
    --------
    Tunnel configured  → https://pi4.lab.vn.ua/control
    No tunnel          → http://10.8.0.10:8080/control
    """
    base = _effective_base_url(node)
    if base:
        return f"{base}/control"
    return f"http://{node.internal_ip}:{node.ws_port}/control"


def get_node_ws_url(node: KvmNode) -> str:
    """Build the WSS/WS URL for the RPi WebSocket control server.

    Used by WebSocketProxyService to open the upstream connection.

    Examples
    --------
    Tunnel configured  → wss://pi4.lab.vn.ua/ws/control
    No tunnel          → ws://10.8.0.10:8080/ws/control
    """
    base = _effective_base_url(node)
    if base:
        # Convert https:// → wss://, http:// → ws://
        ws_base = base.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        return f"{ws_base}/ws/control"
    return f"ws://{node.internal_ip}:{node.ws_port}/ws/control"
