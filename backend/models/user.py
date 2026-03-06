"""
models/user.py

SQLAlchemy ORM model for the ``users`` table.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class User(Base):
    """Represents an authenticated user of the Control Plane.

    Columns
    -------
    id              Primary key (UUID v4).
    username        Unique login handle.
    email           Unique e-mail address.
    hashed_password Bcrypt hash — plain text is never stored.
    is_active       Soft-delete / account suspension flag.
    is_superuser    Grants unrestricted access to all nodes and admin APIs.
    created_at      UTC timestamp of account creation.

    Relationships
    -------------
    node_permissions  Link to ``user_node_permissions`` (M2M with KvmNode).
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Back-reference to the permission join table.
    node_permissions: Mapped[list["UserNodePermission"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "UserNodePermission",
        back_populates="user",
        foreign_keys="UserNodePermission.user_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"
