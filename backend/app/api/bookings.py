from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database.connection import get_db
from app.schemas.schemas import BookingCreate, PaymentRequest, CancellationRequest
from app.services.reservation_service import ReservationService
from app.services.idempotency_service import IdempotencyService
from app.services.dsa_manager import dsa_manager
from app.models.entities import Booking

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/hold")
def create_booking_hold(
    req: BookingCreate,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    key = req.idempotency_key or x_idempotency_key
    if key:
        cached = IdempotencyService.get_record(db, key)
        if cached:
            import json
            return json.loads(cached.response_body)

    try:
        res = ReservationService.create_booking_hold(db, req)
        if key:
            IdempotencyService.save_record(db, key, f"HOLD_{req.train_run_id}", res)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pay")
def pay_for_booking(
    req: PaymentRequest,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    key = req.idempotency_key or x_idempotency_key
    if key:
        cached = IdempotencyService.get_record(db, key)
        if cached:
            import json
            return json.loads(cached.response_body)

    try:
        res = ReservationService.confirm_payment(db, req.pnr, req.simulate_success)
        if key:
            IdempotencyService.save_record(db, key, f"PAY_{req.pnr}", res)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
def cancel_booking(
    req: CancellationRequest,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    key = req.idempotency_key or x_idempotency_key
    if key:
        cached = IdempotencyService.get_record(db, key)
        if cached:
            import json
            return json.loads(cached.response_body)

    try:
        res = ReservationService.cancel_reservation(db, req.pnr, req.passenger_id)
        if key:
            IdempotencyService.save_record(db, key, f"CANCEL_{req.pnr}", res)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

