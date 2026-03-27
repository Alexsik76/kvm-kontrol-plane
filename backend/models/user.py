"""
models/user.py

SQLAlchemy ORM model for the ``users`` table.
"""

import uuid
from datetime import UTC, datetime
from typing import Optional, List, TYPE_CHECKING
import sqlalchemy as sa
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.user_node_permission import UserNodePermission


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(max_length=64, unique=True, nullable=False, index=True)
    email: str = Field(max_length=255, unique=True, nullable=False, index=True)
    hashed_password: str = Field(max_length=255, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    is_superuser: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False),
    )

    node_permissions: List["UserNodePermission"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "foreign_keys": "UserNodePermission.user_id",
        },
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username!r}>"
