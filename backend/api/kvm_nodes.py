"""
api/kvm_nodes.py

KVM node management router — CRUD operations and per-node status retrieval.

Endpoints
---------
    GET    /api/v1/nodes           — list all nodes (paginated)
    POST   /api/v1/nodes           — register a new node (superuser only)
    GET    /api/v1/nodes/{id}      — retrieve node details
    PUT    /api/v1/nodes/{id}      — partial update (superuser only)
    DELETE /api/v1/nodes/{id}      — remove a node (superuser only)
    GET    /api/v1/nodes/{id}/status — current health status
"""

import uuid
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, require_node_access
from db.session import get_db
from models.kvm_node import KvmNode
from models.user import User
from schemas.kvm_node import KvmNodeCreate, KvmNodeRead, KvmNodeUpdate, NodeStatusRead
from services import node_manager

router = APIRouter(prefix="/nodes", tags=["kvm-nodes"])


def _require_superuser(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: restrict endpoint to superusers."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required.",
        )
    return current_user


@router.get("", response_model=List[KvmNodeRead], summary="List all KVM nodes.")
async def list_nodes(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_user)],
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> List[KvmNodeRead]:
    """Return a paginated list of KVM nodes the calling user may see.

    Note: This endpoint currently returns all nodes.  A future enhancement
    should filter by user_node_permissions for non-superusers.
    """
    nodes = await node_manager.get_all_nodes(db, offset=offset, limit=limit)
    return [KvmNodeRead.model_validate(n) for n in nodes]


@router.post(
    "",
    response_model=KvmNodeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new KVM node (superuser only).",
)
async def create_node(
    data: KvmNodeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _superuser: Annotated[User, Depends(_require_superuser)],
) -> KvmNodeRead:
    """Create a new KVM node record.  Internal IP is stored but never sent to clients."""
    node = await node_manager.create_node(db, data)
    return KvmNodeRead.model_validate(node)


@router.get("/{node_id}", response_model=KvmNodeRead, summary="Get KVM node details.")
async def get_node(
    node: Annotated[KvmNode, Depends(require_node_access())],
) -> KvmNodeRead:
    """Retrieve a KVM node by ID. Requires at least ``can_view`` permission."""
    return KvmNodeRead.model_validate(node)


@router.put(
    "/{node_id}",
    response_model=KvmNodeRead,
    summary="Update a KVM node (superuser only).",
)
async def update_node(
    node_id: uuid.UUID,
    data: KvmNodeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _superuser: Annotated[User, Depends(_require_superuser)],
) -> KvmNodeRead:
    """Partially update a KVM node's configuration."""
    node = await node_manager.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Node not found."
        )
    updated = await node_manager.update_node(db, node, data)
    return KvmNodeRead.model_validate(updated)


@router.delete(
    "/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a KVM node (superuser only).",
)
async def delete_node(
    node_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _superuser: Annotated[User, Depends(_require_superuser)],
) -> None:
    """Remove a KVM node and all associated permission records (cascade delete)."""
    node = await node_manager.get_node(db, node_id)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Node not found."
        )
    await node_manager.delete_node(db, node)


@router.get(
    "/{node_id}/status",
    response_model=NodeStatusRead,
    summary="Get the current health status of a KVM node.",
)
async def get_node_status(
    node: Annotated[KvmNode, Depends(require_node_access())],
) -> NodeStatusRead:
    """Return the most recent status recorded by the health poller."""
    return NodeStatusRead.model_validate(node)
