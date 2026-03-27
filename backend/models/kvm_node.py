from __future__ import annotations
"""
models/kvm_node.py

SQLAlchemy ORM model for the ``kvm_nodes`` table.
"""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, Relationship, SQLModel
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from models.user_node_permission import UserNodePermission


class NodeStatus(str, PyEnum):
    """Health state of a KVM node as stored in the database.

    Updated periodically by the background health-check poller.
    """

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class KvmNode(SQLModel, table=True):
    """Represents a single Raspberry Pi KVM node.

    The ``tunnel_url`` takes priority over ``internal_ip`` + ports when building
    upstream URLs.  Set it to the Cloudflare Tunnel HTTPS address of the RPi
    (e.g. ``https://pi4.lab.vn.ua``).  If empty, the backend falls back to the
    legacy ``internal_ip:port`` scheme.

    Columns
    -------
    id                  Primary key (UUID v4).
    name                Human-readable label for the node.
    internal_ip         Fallback VPN/LAN IP of the Raspberry Pi (e.g. 10.8.0.10).
    tunnel_url          Cloudflare Tunnel HTTPS base URL (overrides internal_ip).
    ws_port             Port of the local WebSocket control server (default 8080).
    mediamtx_api_port   Port of the MediaMTX HTTP API (default 9997).
    status              Current health state (see NodeStatus enum).
    last_seen_at        UTC timestamp of the last successful health-check.
    created_at          UTC timestamp when the node record was created.

    Relationships
    -------------
    user_permissions    Link to ``user_node_permissions`` (M2M with User).
    """

    __tablename__ = "kvm_nodes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=64, unique=True, nullable=False)
    internal_ip: str = Field(max_length=45, nullable=False)  # IPv4/IPv6 fallback
    tunnel_url: Optional[str] = Field(
        default=None,
        sa_column=Column(sa.String(255), nullable=True),
        description="Cloudflare Tunnel HTTPS base URL (e.g. https://pi4.lab.vn.ua). "
        "When set, overrides internal_ip + ports for all backend→RPi calls.",
    )
    ws_port: int = Field(default=8080, nullable=False)
    mediamtx_api_port: int = Field(default=9997, nullable=False)
    stream_name: str = Field(
        max_length=64,
        default="kvm",
        sa_column_kwargs={"server_default": "kvm"},
        nullable=False,
    )
    mediamtx_user: str = Field(
        default="admin",
        max_length=64,
        nullable=False,
        sa_column_kwargs={"server_default": "admin"}
    )
    mediamtx_pass: str = Field(
        default="password",
        max_length=64,
        nullable=False,
        sa_column_kwargs={"server_default": "password"}
    )
    status: NodeStatus = Field(
        default=NodeStatus.UNKNOWN,
        sa_column=Column(
            sa.Enum(NodeStatus, name="node_status"),
            nullable=False,
            default=NodeStatus.UNKNOWN,
        ),
    )
    machine_info: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    screenshot: Optional[str] = Field(default=None, sa_column=Column(sa.Text))
    # Optional[X] inside Mapped[] works on SA>=2.0.41 / Python 3.14
    last_seen_at: Optional[datetime] = Field(
        default=None, sa_column=Column(sa.DateTime(timezone=True))
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(sa.DateTime(timezone=True), nullable=False),
    )

    user_permissions: list[UserNodePermission] = Relationship(
        back_populates="node",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    def __repr__(self) -> str:
        return f"<KvmNode id={self.id} name={self.name!r} status={self.status}>"
