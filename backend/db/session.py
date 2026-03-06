"""
db/session.py

Async SQLAlchemy engine and session factory.

The module exposes:
    - engine          : AsyncEngine singleton (created once at import time)
    - AsyncSessionLocal : session factory
    - get_db()        : async generator used as a FastAPI Depends

Usage in a route
----------------
    from db.session import get_db

    @router.get("/something")
    async def my_route(db: AsyncSession = Depends(get_db)):
        ...
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings

# ---------------------------------------------------------------------------
# Engine — created once, reused for the application lifetime
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # log SQL when DEBUG=true
    pool_pre_ping=True,  # detect stale connections before use
    pool_size=10,
    max_overflow=20,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # don't expire objects after commit (async-safe)
    autobegin=True,
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session; roll back on error, always close on exit."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
