"""
models/kvm_node.py

SQLAlchemy ORM model for the ``kvm_nodes`` table.
"""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Uuid, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class NodeStatus(str, PyEnum):
    """Health state of a KVM node as stored in the database.

    Updated periodically by the background health-check poller.
    """

    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class KvmNode(Base):
    """Represents a single Raspberry Pi KVM node.

    The ``internal_ip`` and ports are used by backend services to communicate
    with the node over the private VPN tunnel — never exposed to the browser.

    Columns
    -------
    id                  Primary key (UUID v4).
    name                Human-readable label for the node.
    internal_ip         VPN/tunnel IP of the Raspberry Pi (e.g. 10.8.0.10).
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

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    internal_ip: Mapped[str] = mapped_column(String(45), nullable=False)  # IPv4/IPv6
    ws_port: Mapped[int] = mapped_column(Integer, default=8080, nullable=False)
    mediamtx_api_port: Mapped[int] = mapped_column(
        Integer, default=9997, nullable=False
    )
    stream_name: Mapped[str] = mapped_column(
        String(64), default="kvm", server_default="kvm", nullable=False
    )
    status: Mapped[NodeStatus] = mapped_column(
        Enum(NodeStatus, name="node_status"),
        default=NodeStatus.UNKNOWN,
        nullable=False,
    )
    machine_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    screenshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional[X] inside Mapped[] works on SA>=2.0.41 / Python 3.14
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    user_permissions: Mapped[list["UserNodePermission"]] = relationship(  # type: ignore[name-defined]
        "UserNodePermission",
        back_populates="node",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<KvmNode id={self.id} name={self.name!r} status={self.status}>"
