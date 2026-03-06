"""
core/dependencies.py

FastAPI dependency factories consumed by API route handlers.

Dependency tree
---------------
    get_current_user
        ↳ OAuth2PasswordBearer (extracts Bearer token from Authorization header)
        ↳ verify_token (validates JWT signature and expiry)
        ↳ DB lookup of the User record

    require_node_access(node_id, require_control=False)
        ↳ get_current_user
        ↳ Query UserNodePermission for the (user_id, node_id) pair
        ↳ Superusers bypass the table check entirely (Principle of Least Privilege
          still applies — superuser is an explicit flag, not a default)

FIDO2 / WebAuthn hook
---------------------
When 2FA is added, an additional dependency `require_mfa_verified` can check
for the "fido" value in the JWT ``amr`` claim before allowing sensitive actions
such as WS proxy connections.  The placeholder is documented here.
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import verify_token
from db.session import get_db
from models.kvm_node import KvmNode
from models.user import User
from models.user_node_permission import UserNodePermission

# ---------------------------------------------------------------------------
# OAuth2 scheme — clients send:  Authorization: Bearer <access_token>
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate the JWT and return the authenticated User from the database.

    Raises
    ------
    401 UNAUTHORIZED
        If the token is missing, expired, or has an invalid signature.
    401 UNAUTHORIZED
        If the user referenced by the token no longer exists in the DB.
    403 FORBIDDEN
        If the user's account is inactive (soft-deleted / suspended).
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(token, expected_type="access")
    except JWTError:
        raise credentials_exc

    user_id: str = payload.sub
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()

    if user is None:
        raise credentials_exc

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    return user


# ---------------------------------------------------------------------------
# require_node_access — permission-checked node resolver
# ---------------------------------------------------------------------------
def require_node_access(*, require_control: bool = False):
    """Return a FastAPI dependency that resolves and authorises access to a node.

    Parameters
    ----------
    require_control:
        If True, the user must have ``can_control=True`` in addition to
        ``can_view=True``.  Pass True for the WS proxy endpoint; False for
        read-only endpoints like status or signaling.

    Usage in a route
    ----------------
        @router.get("/nodes/{node_id}/status")
        async def get_status(
            node: KvmNode = Depends(require_node_access()),
            ...
        ):
            ...

        @router.websocket("/nodes/{node_id}/ws")
        async def ws_proxy(
            node: KvmNode = Depends(require_node_access(require_control=True)),
            ...
        ):
            ...
    """

    async def _inner(
        node_id: uuid.UUID,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> KvmNode:
        """Resolve the KvmNode and verify the user's permission to access it."""
        # 1. Resolve the node
        node_result = await db.execute(select(KvmNode).where(KvmNode.id == node_id))
        node = node_result.scalars().first()

        if node is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"KVM node '{node_id}' not found.",
            )

        # 2. Superusers bypass the permission table
        if current_user.is_superuser:
            return node

        # 3. Check the user_node_permissions join table
        perm_result = await db.execute(
            select(UserNodePermission).where(
                UserNodePermission.user_id == current_user.id,
                UserNodePermission.node_id == node_id,
            )
        )
        permission = perm_result.scalars().first()

        if permission is None or not permission.can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this KVM node.",
            )

        if require_control and not permission.can_control:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to control this KVM node.",
            )

        return node

    return _inner
