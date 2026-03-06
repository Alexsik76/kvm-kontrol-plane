"""
core/token_schemas.py

Internal Pydantic model for a decoded JWT payload.

Kept in the ``core`` package (not in ``schemas``) to avoid a cross-layer
import: ``core/security.py`` needs this type, and ``core`` must not depend
on the ``schemas`` package which sits at a higher layer.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class TokenPayload(BaseModel):
    """Parsed content of a validated JWT.

    Not exposed through the API; used internally by:
        - core/security.py  → returned by verify_token()
        - core/dependencies.py → inspected to resolve the current user
    """

    sub: str  # user UUID as string
    type: Literal["access", "refresh"]
    exp: datetime  # expiry timestamp (UTC-aware)
