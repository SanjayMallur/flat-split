from typing import List

from fastapi import APIRouter, Depends

from database import get_db
from routers.auth import current_user
from schemas import BalanceResponse

router = APIRouter()


@router.get("", response_model=List[BalanceResponse])
async def get_balances(db=Depends(get_db), user=Depends(current_user)):
    flatmate_cursor = db["flatmates"].find(
        {"flat_key": "shared"}, {"email": 1}
    ).sort("_id", 1)
    flatmates = await flatmate_cursor.to_list(length=None)
    if not flatmates:
        return []

    pipeline = [
        {"$match": {"flat_key": "shared"}},
        {"$group": {"_id": "$payer_id", "paid_cents": {"$sum": "$amount_cents"}}},
    ]
    expense_cursor = await db["items"].aggregate(pipeline)
    payments = await expense_cursor.to_list(length=None)
    paid_by_flatmate = {payment["_id"]: payment["paid_cents"] for payment in payments}
    total_cents = sum(payment["paid_cents"] for payment in payments)
    base_share, remainder = divmod(total_cents, len(flatmates))

    balances = []
    for index, flatmate in enumerate(flatmates):
        share_cents = base_share + (1 if index < remainder else 0)
        balance_cents = share_cents - paid_by_flatmate.get(flatmate["_id"], 0)
        status = "owed" if balance_cents > 0 else "owed_to" if balance_cents < 0 else "settled"
        balances.append({
            "flatmate_id": str(flatmate["_id"]),
            "email": flatmate["email"],
            "balance_cents": balance_cents,
            "status": status,
        })
    return balances
