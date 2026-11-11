from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import datetime

class PassengerCreate(BaseModel):
    name: str
    age: int
    gender: str
    berth_preference: Optional[str] = "NO_PREFERENCE"  # LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER

    @field_validator("gender", mode="before")
    @classmethod
    def normalize_gender(cls, v: str) -> str:
        return str(v).strip().upper() if v else "M"

    @field_validator("berth_preference", mode="before")
    @classmethod
    def normalize_berth_pref(cls, v: Optional[str]) -> str:
        return str(v).strip().upper() if v else "NO_PREFERENCE"

class BookingCreate(BaseModel):
    train_run_id: int
    quota: str = "GN"  # GN, TQ, LD, SS
    passengers: List[PassengerCreate]
    idempotency_key: Optional[str] = None

    @field_validator("quota", mode="before")
    @classmethod
    def normalize_quota(cls, v: str) -> str:
        return str(v).strip().upper() if v else "GN"

class PaymentRequest(BaseModel):
    pnr: str
    amount: float
    simulate_success: bool = True
    idempotency_key: Optional[str] = None

    @field_validator("pnr", mode="before")
    @classmethod
    def normalize_pnr(cls, v: str) -> str:
        return str(v).strip().upper()

class CancellationRequest(BaseModel):
    pnr: str
    passenger_id: Optional[int] = None
    idempotency_key: Optional[str] = None

    @field_validator("pnr", mode="before")
    @classmethod
    def normalize_pnr(cls, v: str) -> str:
        return str(v).strip().upper()

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

class CoachConfig(BaseModel):
    coach_code: str = "S1"
    coach_type: str = "SL"
    total_berths: int = 16

class TrainCreateRequest(BaseModel):
    train_number: str
    train_name: str
    source_station: str
    destination_station: str
    run_dates: List[str]
    coaches: Optional[List[CoachConfig]] = None


