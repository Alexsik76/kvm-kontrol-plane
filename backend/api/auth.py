"""
api/auth.py

Authentication router — handles login, token refresh, and logout.

Endpoints
---------
    POST /api/v1/auth/login    — exchange credentials for JWT pair
    POST /api/v1/auth/refresh  — exchange refresh token for new access token
    POST /api/v1/auth/logout   — stub; token blocklist is a future enhancement
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlmodel import select

from core.dependencies import SessionDep
from core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    verify_token,
)
from models.user import User
from schemas.auth import RefreshRequest, TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Obtain JWT access and refresh tokens.",
)
async def login(
    credentials: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: SessionDep,
) -> TokenResponse:
    """Authenticate with username + password; return an access/refresh token pair.

    The access token is short-lived (default 30 min) and should be stored in
    memory only.  The refresh token is long-lived (7 days) and can be stored
    in an httpOnly cookie on the client side.
    """
    result = await db.execute(select(User).where(User.username == credentials.username))
    user: User | None = result.scalars().first()

    if user is None or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    logger.info("User '%s' authenticated successfully.", user.username)
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh an expired access token using a valid refresh token.",
)
async def refresh(
    body: RefreshRequest,
    db: SessionDep,
) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair.

    Rotation strategy: a new refresh token is issued on every call so that
    single-use refresh tokens can be enforced when a blocklist is added later.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(body.refresh_token, expected_type="refresh")
    except JWTError:
        raise credentials_exc

    import uuid

    result = await db.execute(select(User).where(User.id == uuid.UUID(payload.sub)))
    user: User | None = result.scalars().first()

    if user is None or not user.is_active:
        raise credentials_exc

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Invalidate the current session (stub — requires token blocklist).",
)
async def logout() -> None:
    """Logout stub.

    Currently a no-op: stateless JWTs cannot be invalidated without a server-
    side blocklist.  A future implementation should store the token's ``jti``
    claim in a Redis blocklist with a TTL equal to the token's remaining
    lifetime.  The ``get_current_user`` dependency would then check the blocklist
    before accepting a token.
    """
    return  # 204 No Content
