"""
Pydantic Schemas for API Request/Response Models

Includes helpers for MongoDB ObjectId serialization.
"""
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict, GetCoreSchemaHandler
from pydantic_core import core_schema
from typing import Optional, Any, Literal


def serialize_doc(doc: dict) -> dict:
    """
    Convert MongoDB document _id (ObjectId) to string id for API responses.

    Usage:
        task = await db["tasks"].find_one({"_id": ObjectId(task_id)})
        return serialize_doc(task)
    """
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def serialize_docs(docs: list) -> list:
    """Serialize a list of MongoDB documents."""
    return [serialize_doc(doc) for doc in docs]


class PyObjectId(str):
    """
    Pydantic v2 custom type that accepts a MongoDB ObjectId (or a valid
    ObjectId string) and serializes to a string.

    Use in Pydantic models:
        class Task(BaseModel):
            id: Optional[PyObjectId] = Field(default=None, alias="_id")
    """
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: GetCoreSchemaHandler):
        def _validate(v: Any) -> str:
            if isinstance(v, ObjectId):
                return str(v)
            if isinstance(v, str) and ObjectId.is_valid(v):
                return v
            raise ValueError(f"Invalid ObjectId: {v}")

        return core_schema.no_info_plain_validator_function(
            _validate,
            serialization=core_schema.to_string_ser_schema(),
        )


class StatusResponse(BaseModel):
    """Standard status response."""
    status: str
    message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FlatmateResponse(BaseModel):
    """An enrolled member of the shared flat."""
    id: PyObjectId
    user_id: PyObjectId
    email: str
    flat_key: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ItemCreate(BaseModel):
    """Client supplied expense fields; identity and flat are set by the server."""
    amount_cents: int = Field(..., gt=0, strict=True)
    category: Literal["rent", "groceries", "bills"]
    payer_id: PyObjectId

    model_config = ConfigDict(extra="forbid")


class ItemResponse(BaseModel):
    """A saved shared expense."""
    id: PyObjectId
    amount_cents: int
    category: Literal["rent", "groceries", "bills"]
    payer_id: PyObjectId
    created_by: PyObjectId
    flat_key: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class BalanceResponse(BaseModel):
    """Computed share minus the amount paid by one flatmate."""
    flatmate_id: PyObjectId
    email: str
    balance_cents: int
    status: Literal["owed", "owed_to", "settled"]

    model_config = ConfigDict(from_attributes=True)
