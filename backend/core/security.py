"""
core/security.py

Security utilities: JWT token creation/verification and password hashing.

JWT strategy
------------
- Access tokens  : short-lived (default 30 min), HS256
- Refresh tokens : long-lived (default 7 days), HS256
  Both are signed with the same JWT_SECRET_KEY, but the 'type' claim
  differentiates them so a refresh token cannot be used as an access token.

Password hashing
----------------
Uses passlib with bcrypt so hashed passwords are safe to store in the DB.

Future-proofing for 2FA / FIDO2
---------------------------------
When WebAuthn is added, this module will be extended with helpers that
generate and verify FIDO2 challenges.  The JWT 'amr' (Authentication Methods
References) claim is reserved in the TokenPayload for this purpose.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal

from jose import JWTError, jwt
import bcrypt

from core.config import settings
from core.token_schemas import TokenPayload


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    salt = bcrypt.gensalt()
    # bcrypt requires bytes, returns bytes
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* password."""
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

TokenType = Literal["access", "refresh"]


def _create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
) -> str:
    """Internal factory that encodes a JWT with standard claims.

    Parameters
    ----------
    subject:
        The ``sub`` claim — typically the user's UUID as a string.
    token_type:
        Embedded in the ``type`` claim to prevent token-type confusion attacks.
    expires_delta:
        How long the token should be valid.

    Returns
    -------
    str
        A signed JWT string.
    """
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        # Reserved for Authentication Methods References (e.g. "mfa", "fido")
        # Populate this claim when 2FA / WebAuthn is implemented.
        "amr": [],
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create a short-lived access token.

    Parameters
    ----------
    subject:
        User identifier (UUID string).
    expires_delta:
        Override the default expiry from settings. Useful in tests.
    """
    delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, "access", delta)


def create_refresh_token(subject: str) -> str:
    """Create a long-lived refresh token.

    Parameters
    ----------
    subject:
        User identifier (UUID string).
    """
    delta = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    return _create_token(subject, "refresh", delta)


def verify_token(token: str, expected_type: TokenType = "access") -> TokenPayload:
    """Decode and validate a JWT, returning its parsed payload.

    Parameters
    ----------
    token:
        Raw JWT string from the Authorization header or cookie.
    expected_type:
        Must match the ``type`` claim inside the token.

    Raises
    ------
    JWTError
        If the token is expired, has a bad signature, or its type does not
        match *expected_type*.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    token_type: str = payload.get("type", "")
    if token_type != expected_type:
        raise JWTError(
            f"Invalid token type: expected '{expected_type}', got '{token_type}'"
        )

    return TokenPayload(
        sub=payload["sub"],
        type=token_type,  # type: ignore[arg-type]
        exp=datetime.fromtimestamp(payload["exp"], tz=UTC),
    )
