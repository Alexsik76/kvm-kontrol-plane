"""
services/node_manager.py

Async CRUD helper functions for KVM node records.

Keeping database operations in a dedicated service module follows SRP and
makes the API router thin (route handler only deals with HTTP concerns).
All functions accept an AsyncSession injected by the FastAPI Depends chain.
"""

import uuid
from typing import Optional, Sequence

from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.kvm_node import KvmNode
from schemas.kvm_node import KvmNodeCreate, KvmNodeUpdate


async def get_node(db: AsyncSession, node_id: uuid.UUID) -> Optional[KvmNode]:
    """Fetch a single KVM node by primary key; return None if not found."""
    result = await db.execute(select(KvmNode).where(KvmNode.id == node_id))
    return result.scalars().first()


async def get_all_nodes(
    db: AsyncSession,
    offset: int = 0,
    limit: int = 100,
) -> Sequence[KvmNode]:
    """Return a paginated list of all KVM nodes."""
    result = await db.execute(
        select(KvmNode).order_by(KvmNode.name).offset(offset).limit(limit)
    )
    return result.scalars().all()


async def create_node(db: AsyncSession, data: KvmNodeCreate) -> KvmNode:
    """Persist a new KVM node record and return it with server-generated fields."""
    node = KvmNode(
        name=data.name,
        internal_ip=data.internal_ip,
        ws_port=data.ws_port,
        mediamtx_api_port=data.mediamtx_api_port,
        stream_name=data.stream_name,
        machine_info=data.machine_info,
    )
    db.add(node)
    await db.flush()  # get the generated UUID before commit
    await db.refresh(node)
    return node


async def update_node(
    db: AsyncSession,
    node: KvmNode,
    data: KvmNodeUpdate,
) -> KvmNode:
    """Apply a partial update to an existing node record.

    Only fields explicitly set in *data* (i.e. not None) are changed,
    preserving all other columns.
    """
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(node, field, value)
    await db.flush()
    await db.refresh(node)
    return node


async def delete_node(db: AsyncSession, node: KvmNode) -> None:
    """Delete a KVM node record (cascades to user_node_permissions)."""
    await db.delete(node)
    await db.flush()
