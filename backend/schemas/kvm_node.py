from __future__ import annotations

"""
schemas/kvm_node.py

Pydantic models for KVM node management API endpoints.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class NodeStatus(str, Enum):
    """Possible health states for a KVM node."""

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class KvmNodeBase(SQLModel):
    """Shared fields between create and read schemas."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=64,
    )
    internal_ip: str = Field(
        ...,
        description="Fallback VPN/LAN IP address of the Raspberry Pi.",
    )
    tunnel_url: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Cloudflare Tunnel HTTPS base URL (e.g. https://pi4.lab.vn.ua). "
        "When set, overrides internal_ip + ports for all backend→RPi calls.",
    )
    ws_port: int = Field(default=8080, ge=1, le=65535)
    mediamtx_api_port: int = Field(default=9997, ge=1, le=65535)
    stream_name: str = Field(
        default="kvm", min_length=1, max_length=64, description="MediaMTX stream path."
    )
    mediamtx_user: str = Field(
        default="admin", 
        description="Username for MediaMTX internal authentication."
    )
    mediamtx_pass: str = Field(
        default="password", 
        description="Password/Token for MediaMTX internal authentication."
    )


class KvmNodeCreate(KvmNodeBase):
    """Request body for creating a new KVM node."""

    machine_info: Optional[dict] = Field(
        default=None,
        description="Arbitrary JSON metadata describing the node's hardware/specs.",
    )


class KvmNodeUpdate(SQLModel):
    """Request body for partial update — all fields are optional."""

    name: Optional[str] = Field(None, min_length=1, max_length=64)
    internal_ip: Optional[str] = None
    tunnel_url: Optional[str] = Field(
        None,
        max_length=255,
        description="Cloudflare Tunnel HTTPS base URL. Set to empty string to clear.",
    )
    ws_port: Optional[int] = Field(None, ge=1, le=65535)
    mediamtx_api_port: Optional[int] = Field(None, ge=1, le=65535)
    stream_name: Optional[str] = Field(None, min_length=1, max_length=64)
    machine_info: Optional[dict] = None
    screenshot: Optional[str] = Field(
        None, description="Base64 encoded Data URL of the latest screenshot"
    )


class KvmNodeRead(KvmNodeBase):
    """Response schema — includes server-generated fields."""

    id: uuid.UUID
    status: NodeStatus
    machine_info: Optional[dict] = None
    screenshot: Optional[str] = None
    last_seen_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class NodeStatusRead(SQLModel):
    """Lightweight status response for GET /nodes/{id}/status."""

    id: uuid.UUID
    status: NodeStatus
    last_seen_at: Optional[datetime]

    model_config = {"from_attributes": True}
