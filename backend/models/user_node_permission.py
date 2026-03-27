from __future__ import annotations
"""
models/user_node_permission.py

Many-to-many association between ``users`` and ``kvm_nodes`` with fine-grained
per-row permission flags, enforcing the Principle of Least Privilege.

Design rationale
----------------
A simple M2M join table (without extra columns) would only model access as
binary (yes/no).  The ``can_view`` / ``can_control`` flags let administrators
grant a user read-only access to a node's video stream while restricting
keyboard/mouse control — a common requirement in IP-KVM deployments where
multiple people monitor the same machine but only one may interact.

Superusers bypass this table entirely (handled in core/dependencies.py).
"""

import uuid
from datetime import UTC, datetime
from typing import Optional

import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.kvm_node import KvmNode
    from models.user import User


class UserNodePermission(SQLModel, table=True):
    """Grant record linking a user to a KVM node with specific capabilities.

    Columns
    -------
    id            Primary key (UUID v4).
    user_id       FK → users.id  (the grantee).
    node_id       FK → kvm_nodes.id.
    can_view      If True, the user may see the node and watch its video stream.
    can_control   If True, the user may send keyboard/mouse commands (WS proxy).
    granted_at    UTC timestamp when the permission was granted.
    granted_by_id FK → users.id  (the administrator who made the grant).

    Constraints
    -----------
    UNIQUE (user_id, node_id) — one grant record per user-node pair;
    update the flags rather than inserting duplicates.
    """

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
    # SET NULL on delete so removing the granting admin doesn't delete the grant
    granted_by_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
    )

    # ORM relationships — use string refs to avoid circular imports.
    # foreign_keys must be explicit because there are TWO FKs to the users table
    # (user_id and granted_by_id), so SQLAlchemy cannot infer which one to use.
    user: "User" = Relationship(
        back_populates="node_permissions",
        sa_relationship_kwargs={"foreign_keys": "UserNodePermission.user_id"},
    )
    node: "KvmNode" = Relationship(
        back_populates="user_permissions",
        sa_relationship_kwargs={"foreign_keys": "UserNodePermission.node_id"},
    )

    def __repr__(self) -> str:
        return (
            f"<UserNodePermission user={self.user_id} node={self.node_id}"
            f" view={self.can_view} control={self.can_control}>"
        )
