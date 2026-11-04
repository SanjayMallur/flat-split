from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from pymongo import ReturnDocument

from database import get_db
from routers.auth import current_user
from schemas import FlatmateResponse

router = APIRouter()
FLAT_KEY = "shared"


def flatmate_response(doc):
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "email": doc["email"],
        "flat_key": doc["flat_key"],
        "created_at": doc["created_at"],
    }


@router.post("/enroll", status_code=201, response_model=FlatmateResponse)
async def enroll_flatmate(user=Depends(current_user), db=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = await db["flatmates"].find_one_and_update(
        {"user_id": user["_id"]},
        {"$setOnInsert": {
            "user_id": user["_id"],
            "email": user["email"],
            "flat_key": FLAT_KEY,
            "created_at": now,
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return flatmate_response(doc)


@router.get("", response_model=List[FlatmateResponse])
async def list_flatmates(user=Depends(current_user), db=Depends(get_db)):
    cursor = db["flatmates"].find({"flat_key": FLAT_KEY}).sort("_id", 1)
    docs = await cursor.to_list(length=None)
    return [flatmate_response(doc) for doc in docs]
