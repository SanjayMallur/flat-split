from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from routers.auth import current_user
from schemas import ItemCreate, ItemResponse

router = APIRouter()
FLAT_KEY = "shared"


def item_response(doc):
    """Return exactly the fields declared by the items API contract."""
    return {
        "id": str(doc["_id"]),
        "amount_cents": doc["amount_cents"],
        "category": doc["category"],
        "payer_id": str(doc["payer_id"]),
        "created_by": str(doc["created_by"]),
        "flat_key": doc["flat_key"],
        "created_at": doc["created_at"],
    }


@router.get("", response_model=List[ItemResponse])
async def list_items(user=Depends(current_user), db=Depends(get_db)):
    cursor = db["items"].find({"flat_key": FLAT_KEY}).sort("created_at", -1)
    return [item_response(doc) for doc in await cursor.to_list(length=None)]


@router.post("", response_model=ItemResponse, status_code=201)
async def create_item(data: ItemCreate, user=Depends(current_user), db=Depends(get_db)):
    if isinstance(data.amount_cents, bool) or not isinstance(data.amount_cents, int) or data.amount_cents <= 0:
        raise HTTPException(status_code=422, detail="amount_cents must be a positive integer")
    if data.category not in ("rent", "groceries", "bills"):
        raise HTTPException(status_code=422, detail="category must be rent, groceries, or bills")

    payer_id = str(data.payer_id)
    if not ObjectId.is_valid(payer_id):
        raise HTTPException(status_code=422, detail="payer_id must be a valid flatmate ID")
    payer = await db["flatmates"].find_one({"_id": ObjectId(payer_id), "flat_key": FLAT_KEY})
    if payer is None:
        raise HTTPException(status_code=422, detail="payer_id must belong to an enrolled flatmate")

    doc = {
        "amount_cents": data.amount_cents,
        "category": data.category,
        "payer_id": payer["_id"],
        "created_by": user["_id"],
        "flat_key": FLAT_KEY,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    result = await db["items"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return item_response(doc)
