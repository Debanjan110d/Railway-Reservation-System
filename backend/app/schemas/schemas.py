from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import datetime

class PassengerCreate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    age: int = Field(..., ge=1, le=100, description="Age between 1 and 100")
    gender: str
    berth_preference: Optional[str] = "NO_PREFERENCE"  # LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER

    @field_validator("name", mode="before")
    @classmethod
    def populate_name(cls, v: Optional[str], values) -> Optional[str]:
        return str(v).strip() if v else v

    @field_validator("age")
    @classmethod
    def validate_age_range(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError("Passenger age must be between 1 and 100 years.")
        return v

    def model_post_init(self, __context) -> None:
        if not self.name:
            parts = [p.strip() for p in [self.first_name, self.middle_name, self.last_name] if p and p.strip()]
            self.name = " ".join(parts) if parts else "Passenger"

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
    fare_breakdown: Optional[dict] = None
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


