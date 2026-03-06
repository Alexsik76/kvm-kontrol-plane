"""
Alembic environment script for IP-KVM Control Plane.

Supports async SQLAlchemy engines (asyncpg driver). The DATABASE_URL is read
from the environment so that the same alembic.ini can be used across local dev,
CI, and Docker without modification.
"""

import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ---------------------------------------------------------------------------
# Alembic Config object (gives access to alembic.ini values)
# ---------------------------------------------------------------------------
config = context.config

# Inject the DATABASE_URL from the environment, overriding the empty placeholder
# in alembic.ini.  This allows running migrations both locally (with .env) and
# inside Docker (environment variables injected by compose).
database_url = os.environ["DATABASE_URL"]
config.set_main_option("sqlalchemy.url", database_url)

# Set up Python logging as defined in alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Import ORM Base and all model modules AFTER the DATABASE_URL is configured.
# These imports must appear here (not at the top of the file) because Alembic
# env.py runs in a special context where the application's sys.path is set up
# by Alembic itself. noqa: E402 suppressions are intentional.
# ---------------------------------------------------------------------------
from db.base import Base  # noqa: E402
import models.user  # noqa: E402, F401
import models.kvm_node  # noqa: E402, F401
import models.user_node_permission  # noqa: E402, F401

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline mode — generates SQL script without a live DB connection
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (outputs SQL to stdout)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — connects to DB and applies migrations directly
# ---------------------------------------------------------------------------
def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and apply migrations inside a sync wrapper."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # no pooling needed for one-shot migration runs
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migration mode."""
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
