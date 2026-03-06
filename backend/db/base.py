"""
db/base.py

Single declarative base class shared by all SQLAlchemy ORM models.

All model modules must import Base from this module — never create a second
Base instance — so that Alembic autogenerate can discover every table when it
imports ``db.base``.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project-wide SQLAlchemy declarative base.

    Subclass this in every model module:

        class User(Base):
            __tablename__ = "users"
            ...
    """

    pass
