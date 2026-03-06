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

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class UserNodePermission(Base):
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

    __table_args__ = (UniqueConstraint("user_id", "node_id", name="uq_user_node"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("kvm_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    can_view: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_control: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    # SET NULL on delete so removing the granting admin doesn't delete the grant
    granted_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ORM relationships — use string refs to avoid circular imports.
    # foreign_keys must be explicit because there are TWO FKs to the users table
    # (user_id and granted_by_id), so SQLAlchemy cannot infer which one to use.
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="node_permissions",
        foreign_keys=[user_id],
    )
    node: Mapped["KvmNode"] = relationship(  # type: ignore[name-defined]
        "KvmNode",
        back_populates="user_permissions",
        foreign_keys=[node_id],
    )

    def __repr__(self) -> str:
        return (
            f"<UserNodePermission user={self.user_id} node={self.node_id}"
            f" view={self.can_view} control={self.can_control}>"
        )
