"""
schemas/auth.py

Pydantic models for authentication request/response payloads.

Note on TokenPayload
--------------------
TokenPayload is defined in ``core.token_schemas`` (not here) to avoid a
cross-layer import: ``core/security.py`` needs it, and ``core`` must not
import from ``schemas``. It is re-exported here for convenience.
"""

from pydantic import BaseModel

# Re-export so callers can import from either schemas.auth or core.token_schemas
from core.token_schemas import TokenPayload  # noqa: F401


class TokenResponse(BaseModel):
    """Returned after successful authentication or token refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Payload for POST /api/v1/auth/refresh."""

    refresh_token: str
