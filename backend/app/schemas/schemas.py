from pydantic import BaseModel, Field
from typing import List, Optional
import datetime

class PassengerCreate(BaseModel):
    name: str
    age: int
    gender: str
    berth_preference: Optional[str] = "NO_PREFERENCE"  # LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER

class BookingCreate(BaseModel):
    train_run_id: int
    quota: str = "GN"  # GN, TQ, LD, SS
    passengers: List[PassengerCreate]
    idempotency_key: Optional[str] = None

class PaymentRequest(BaseModel):
    pnr: str
    amount: float
    simulate_success: bool = True
    idempotency_key: Optional[str] = None

class CancellationRequest(BaseModel):
    pnr: str
    passenger_id: Optional[int] = None
    idempotency_key: Optional[str] = None

class PassengerResponse(BaseModel):
    id: int
    name: str
    age: int
    gender: str
    status: str
    coach_code: Optional[str] = None
    berth_number: Optional[int] = None
    berth_type: Optional[str] = None
    rac_number: Optional[int] = None
    wl_number: Optional[int] = None

class BookingResponse(BaseModel):
    pnr: str
    train_run_id: int
    booking_status: str
    quota: str
    total_passengers: int
    held_until: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    passengers: List[PassengerResponse]

