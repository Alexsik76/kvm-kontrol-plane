"""
schemas/kvm_node.py

Pydantic models for KVM node management API endpoints.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel


class NodeStatus(StrEnum):
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
    tunnel_url: str | None = Field(
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
    has_front_panel: bool = Field(
        default=False,
        description="Whether this node has an RP2040 front-panel control module attached.",
    )


class KvmNodeCreate(KvmNodeBase):
    """Request body for creating a new KVM node."""

    machine_info: dict | None = Field(
        default=None,
        description="Arbitrary JSON metadata describing the node's hardware/specs.",
    )


class KvmNodeUpdate(SQLModel):
    """Request body for partial update — all fields are optional."""

    name: str | None = Field(None, min_length=1, max_length=64)
    internal_ip: str | None = None
    tunnel_url: str | None = Field(
        None,
        max_length=255,
        description="Cloudflare Tunnel HTTPS base URL. Set to empty string to clear.",
    )
    ws_port: int | None = Field(None, ge=1, le=65535)
    mediamtx_api_port: int | None = Field(None, ge=1, le=65535)
    stream_name: str | None = Field(None, min_length=1, max_length=64)
    mediamtx_user: str | None = Field(None, max_length=64)
    mediamtx_pass: str | None = Field(None, max_length=64)
    machine_info: dict | None = None
    screenshot: str | None = Field(
        None, description="Base64 encoded Data URL of the latest screenshot"
    )
    has_front_panel: bool | None = None


class KvmNodeRead(KvmNodeBase):
    """Response schema — includes server-generated fields."""

    id: uuid.UUID
    status: NodeStatus
    machine_info: dict | None = None
    screenshot: str | None = None
    last_seen_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NodeStatusRead(SQLModel):
    """Lightweight status response for GET /nodes/{id}/status."""

    id: uuid.UUID
    status: NodeStatus
    last_seen_at: datetime | None

    model_config = {"from_attributes": True}
