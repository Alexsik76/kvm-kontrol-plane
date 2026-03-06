"""
db/init_db.py

Standalone seed script that creates the first superuser if it does not already
exist.  Run it once after the initial `alembic upgrade head`:

    python -m db.init_db

The script reads credentials from the environment (same .env file used by the
application), so it works both locally and inside Docker:

    docker compose exec api python -m db.init_db
"""

import asyncio
import logging

from sqlmodel import select

from core.config import settings
from core.security import hash_password
from db.session import AsyncSessionLocal
from models.user import User

logger = logging.getLogger(__name__)


async def _seed() -> None:
    """Create the first superuser if one does not already exist."""
    async with AsyncSessionLocal() as db:
        # Check whether any superuser exists
        result = await db.execute(
            select(User).where(User.is_superuser.is_(True)).limit(1)
        )
        existing = result.scalars().first()

        if existing:
            logger.info(
                "Superuser '%s' already exists — skipping seed.", existing.username
            )
            return

        superuser = User(
            username=settings.FIRST_SUPERUSER,
            email=settings.FIRST_SUPERUSER_EMAIL,
            hashed_password=hash_password(settings.FIRST_SUPERUSER_PASSWORD),
            is_active=True,
            is_superuser=True,
        )
        db.add(superuser)
        await db.commit()
        await db.refresh(superuser)
        logger.info("Created superuser '%s' (id=%s).", superuser.username, superuser.id)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_seed())


if __name__ == "__main__":
    main()
