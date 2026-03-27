"""
models/user_node_permission.py

Many-to-many association between ``users`` and ``kvm_nodes``.
"""

import uuid
from datetime import UTC, datetime
from typing import Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.kvm_node import KvmNode
    from models.user import User


class UserNodePermission(SQLModel, table=True):
    __tablename__ = "user_node_permissions"

    __table_args__ = (sa.UniqueConstraint("user_id", "node_id", name="uq_user_node"),)

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        nullable=False,
        index=True,
    )
    node_id: uuid.UUID = Field(
        foreign_key="kvm_nodes.id",
        ondelete="CASCADE",
        nullable=False,
        index=True,
    )
    can_view: bool = Field(default=True, nullable=False)
    can_control: bool = Field(default=False, nullable=False)
    granted_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False),
    )
    granted_by_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
    )

    user: "User" = Relationship(
        back_populates="node_permissions",
        sa_relationship_kwargs={"foreign_keys": "UserNodePermission.user_id"},
    )
    node: "KvmNode" = Relationship(
        back_populates="user_permissions",
        sa_relationship_kwargs={"foreign_keys": "UserNodePermission.node_id"},
    )

    def __repr__(self) -> str:
        return f"<UserNodePermission user={self.user_id} node={self.node_id}>"
