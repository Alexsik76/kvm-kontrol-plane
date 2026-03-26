from __future__ import annotations
from models.kvm_node import KvmNode
from core.config import settings

def _effective_base_url(node: KvmNode) -> str | None:
    if node.tunnel_url and node.tunnel_url.strip():
        return node.tunnel_url.rstrip("/")
    if settings.NODE_DEFAULT_TUNNEL_URL and settings.NODE_DEFAULT_TUNNEL_URL.strip():
        return settings.NODE_DEFAULT_TUNNEL_URL.rstrip("/")
    return None

def get_node_http_url(node: KvmNode) -> str:
    """Build the base URL for MediaMTX WHEP.
    In MediaMTX v1.12+, WHEP is available at /path/whep.
    """
    base = _effective_base_url(node)
    if base:
        return f"{base}/{node.stream_name}/whep"
    return f"http://{node.internal_ip}:8889/{node.stream_name}/whep"

def get_node_control_url(node: KvmNode) -> str:
    base = _effective_base_url(node)
    if base:
        return f"{base}"
    return f"http://{node.internal_ip}:{node.ws_port}"

def get_node_ws_url(node: KvmNode) -> str:
    base = _effective_base_url(node)
    if base:
        ws_base = base.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        return f"{ws_base}/ws/control"
    return f"ws://{node.internal_ip}:{node.ws_port}/ws/control"
