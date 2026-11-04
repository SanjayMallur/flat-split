"""
MongoDB Database Connection

Provides async MongoDB client and database access for FastAPI routes.
Uses connection pooling with sensible defaults for containerized environments.
"""
import asyncio
import logging
from typing import Optional
from pymongo import AsyncMongoClient
from pymongo.errors import ConnectionFailure
from config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncMongoClient] = None
_lock = asyncio.Lock()


async def get_client() -> AsyncMongoClient:
    """
    Get or create the MongoDB client singleton.

    Uses double-checked locking to prevent race conditions during initialization.
    Connection pool is configured for containerized environments (256MB-512MB RAM).
    """
    global _client
    if _client is None:
        async with _lock:
            if _client is None:
                settings = get_settings()
                logger.debug("📂 Creating MongoDB client connection...")
                _client = AsyncMongoClient(
                    settings.MONGODB_URL,
                    maxPoolSize=10,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=10000,
                )
                logger.debug("   MongoDB client created successfully")
    return _client


async def get_db():
    """
    FastAPI dependency that returns the MongoDB database handle.

    Usage in routes:
        @router.get("/items")
        async def list_items(db = Depends(get_db)):
            items = await db["items"].find().to_list(length=100)
            return items
    """
    client = await get_client()
    settings = get_settings()
    return client[settings.MONGODB_DATABASE]


async def ping_db():
    """
    Test database connectivity.

    Used during startup to verify MongoDB is reachable.
    Raises ConnectionFailure if ping fails.
    """
    client = await get_client()
    await client.admin.command("ping")


async def close_db():
    """
    Close the database connection.

    Called during application shutdown to release resources.
    """
    global _client
    if _client:
        logger.debug("📁 Closing MongoDB client connection...")
        await _client.close()
        _client = None
        logger.debug("   MongoDB client closed")
