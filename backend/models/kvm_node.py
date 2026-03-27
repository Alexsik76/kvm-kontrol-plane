"""
models/kvm_node.py

SQLAlchemy ORM model for the ``kvm_nodes`` table.
"""

import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum
from typing import Optional, List, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.user_node_permission import UserNodePermission


class NodeStatus(str, PyEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class KvmNode(SQLModel, table=True):
    __tablename__ = "kvm_nodes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=64, unique=True, nullable=False)
    internal_ip: str = Field(max_length=45, nullable=False)
    tunnel_url: Optional[str] = Field(
        default=None,
        sa_column=Column(sa.String(255), nullable=True),
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
    last_seen_at: Optional[datetime] = Field(
        default=None, sa_column=Column(sa.DateTime(timezone=True))
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(sa.DateTime(timezone=True), nullable=False),
    )

    user_permissions: List["UserNodePermission"] = Relationship(
        back_populates="node",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    def __repr__(self) -> str:
        return f"<KvmNode id={self.id} name={self.name!r} status={self.status}>"
