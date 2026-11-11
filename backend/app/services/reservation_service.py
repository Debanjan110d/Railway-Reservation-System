import uuid
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import TrainRun, Coach, Berth, Booking, Passenger, Payment
from app.schemas.schemas import BookingCreate
from app.core.config import settings
from app.services.dsa_manager import dsa_manager
from app.dsa.priority_queue import PriorityQueueEntry

class ReservationService:
    @staticmethod
    def generate_pnr() -> str:
        # 10-digit Indian Railway format PNR
        return f"{uuid.uuid4().int % 10000000000:010d}"

    CLASS_BASE_FARES = {
        "2S": 120.0,
        "SL": 250.0,
        "CC": 600.0,
        "3AC": 850.0,
        "2AC": 1200.0,
        "EC": 1800.0,
    }

    TATKAL_RULES = {
        "2S": {"rate": 0.10, "min": 10.0, "max": 15.0},
        "SL": {"rate": 0.10, "min": 100.0, "max": 200.0},
        "CC": {"rate": 0.30, "min": 125.0, "max": 225.0},
        "3AC": {"rate": 0.30, "min": 300.0, "max": 400.0},
        "2AC": {"rate": 0.30, "min": 400.0, "max": 500.0},
        "EC": {"rate": 0.30, "min": 400.0, "max": 500.0},
    }

    @classmethod
    def calculate_fare_breakdown(cls, coach_type: str, quota: str, num_passengers: int = 1) -> Dict[str, Any]:
        c_type = coach_type.upper() if coach_type else "2AC"
        base_per_pax = cls.CLASS_BASE_FARES.get(c_type, 500.0)
        tatkal_per_pax = 0.0

        if quota.upper() == "TQ":
            rules = cls.TATKAL_RULES.get(c_type, {"rate": 0.30, "min": 100.0, "max": 500.0})
            raw_charge = base_per_pax * rules["rate"]
            tatkal_per_pax = min(rules["max"], max(rules["min"], raw_charge))

        per_pax_total = base_per_pax + tatkal_per_pax
        total_fare = per_pax_total * num_passengers

        return {
            "coach_type": c_type,
            "quota": quota.upper(),
            "base_fare": base_per_pax,
            "tatkal_charge": tatkal_per_pax,
            "per_passenger_fare": per_pax_total,
            "total_passengers": num_passengers,
            "total_fare": total_fare,
            "currency": "INR"
        }

    @classmethod
    def validate_quota_eligibility(cls, quota: str, passengers: List[PassengerCreate]):
        quota = quota.upper()
        if quota == "SS":
            # Senior Citizen: Men >= 60, Women >= 58
            for p in passengers:
                gender = (p.gender or "M").strip().upper()
                min_age = 58 if gender in ["F", "FEMALE"] else 60
                if p.age < min_age:
                    raise ValueError(
                        f"Passenger '{p.name or 'Passenger'}' (age {p.age}) does not qualify for Senior Citizen (SS) Quota. Minimum age is {min_age}."
                    )
        elif quota == "LD":
            # Ladies Quota: All adult passengers must be female, or accompanied children <= 12
            for p in passengers:
                gender = (p.gender or "").strip().upper()
                if gender not in ["F", "FEMALE"] and p.age > 12:
                    raise ValueError(
                        f"Passenger '{p.name or 'Passenger'}' is not eligible for Ladies Quota (LD). Must be female or accompanied child <= 12 years."
                    )
        elif quota == "TQ":
            # Tatkal Quota: Valid booking window
            pass
        elif quota == "GN":
            # General: No special age or gender restrictions
            pass
        else:
            raise ValueError(f"Unknown quota '{quota}'. Supported quotas are: GN, SS, LD, TQ.")

    @classmethod
    def create_booking_hold(cls, db: Session, req: BookingCreate) -> Dict[str, Any]:
        """
        Creates a temporary reservation hold (AVAILABLE -> HELD).
        Validates quota eligibility and allocates physical berths or waitlist.
        """
        # Expire any old holds first
        cls.cleanup_expired_holds(db)

        # Validate quota eligibility before holding seats
        cls.validate_quota_eligibility(req.quota, req.passengers)

        # 1. Fetch available berths for this train run
        # Join berths with coach to ensure valid train_run
        available_berths = (
            db.query(Berth)
            .join(Coach, Berth.coach_id == Coach.id)
            .filter(
                Coach.train_run_id == req.train_run_id,
                Berth.current_status == "AVAILABLE"
            )
            .all()
        )

        pnr = cls.generate_pnr()
        now = datetime.datetime.utcnow()
        held_until = now + datetime.timedelta(seconds=settings.SEAT_HOLD_DURATION_SECONDS)

        num_passengers = len(req.passengers)
        
        # Decide category: Confirmed, RAC, or Waiting
        booking_status = "HELD" if len(available_berths) >= num_passengers else "HELD_WL"

        new_booking = Booking(
            pnr=pnr,
            train_run_id=req.train_run_id,
            booking_status=booking_status,
            quota=req.quota.upper(),
            total_passengers=num_passengers,
            held_until=held_until,
            created_at=now,
            updated_at=now
        )
        db.add(new_booking)
        db.flush()

        # Prioritize lower berths for Senior Citizen (SS) quota
        if req.quota.upper() == "SS":
            lower_berths = [b for b in available_berths if b.berth_type == "LOWER"]
            other_berths = [b for b in available_berths if b.berth_type != "LOWER"]
            allocated_pool = lower_berths + other_berths
        else:
            allocated_pool = list(available_berths)

        passenger_records = []
        pq = dsa_manager.get_priority_queue(req.train_run_id)

        for i, p_info in enumerate(req.passengers):
            if i < len(allocated_pool):
                # Physical berth allocated
                berth = allocated_pool[i]
                berth.current_status = "HELD"
                berth.active_booking_id = new_booking.id

                p_record = Passenger(
                    booking_id=new_booking.id,
                    name=p_info.name,
                    age=p_info.age,
                    gender=p_info.gender,
                    berth_preference=p_info.berth_preference,
                    allocated_berth_id=berth.id,
                    status="HELD_CNF"
                )
            else:
                # Waiting-List allocation
                p_record = Passenger(
                    booking_id=new_booking.id,
                    name=p_info.name,
                    age=p_info.age,
                    gender=p_info.gender,
                    berth_preference=p_info.berth_preference,
                    allocated_berth_id=None,
                    status="HELD_WL",
                    wl_number=len(pq) + 1
                )

            db.add(p_record)
            passenger_records.append(p_record)

        db.commit()

        # Update DSA Structures: Bloom Filter & PNR Hash Table
        pnr_summary = {
            "pnr": pnr,
            "train_run_id": req.train_run_id,
            "status": booking_status,
            "passengers": [p.name for p in passenger_records],
            "held_until": str(held_until)
        }
        dsa_manager.pnr_table.insert(pnr, pnr_summary)
        dsa_manager.bloom_filter.add(pnr)

        return cls.format_booking_response(new_booking, passenger_records)

    @classmethod
    def confirm_payment(cls, db: Session, pnr: str, simulate_success: bool = True) -> Dict[str, Any]:
        """
        Processes simulated payment:
        HELD -> CONFIRMED (if success)
        HELD -> AVAILABLE / Rolled back (if fail or expired)
        """
        cls.cleanup_expired_holds(db)

        booking = db.query(Booking).filter(Booking.pnr == pnr).first()
        if not booking:
            raise ValueError(f"Booking with PNR {pnr} not found.")

        if booking.booking_status in ["CONFIRMED", "RAC", "WAITING"]:
            # Already finalized
            return cls.format_booking_response(booking, booking.passengers)

        if not simulate_success:
            # Payment failed: Release all held berths immediately
            cls._release_held_booking(db, booking, "PAYMENT_FAILED")
            db.commit()
            raise ValueError("Payment simulation resulted in failure. Held seats released.")

        # Payment success: Finalize booking and update waitlist heaps
        now = datetime.datetime.utcnow()
        if booking.held_until and booking.held_until < now:
            # Expired hold: Check if berth was already stolen
            cls._release_held_booking(db, booking, "EXPIRED_BEFORE_PAYMENT")
            db.commit()
            raise ValueError("Seat hold expired before payment was completed.")

        # Finalize status
        has_waiting = any(p.status == "HELD_WL" for p in booking.passengers)
        booking.booking_status = "WAITING" if has_waiting else "CONFIRMED"
        booking.held_until = None

        pq = dsa_manager.get_priority_queue(booking.train_run_id)

        for p in booking.passengers:
            if p.allocated_berth_id:
                p.status = "CNF"
                berth = db.query(Berth).filter(Berth.id == p.allocated_berth_id).first()
                if berth:
                    berth.current_status = "CONFIRMED"
            else:
                p.status = "WL"
                # Add to priority queue
                pq_entry = PriorityQueueEntry(
                    passenger_id=p.id,
                    pnr=pnr,
                    quota=booking.quota,
                    age=p.age,
                    timestamp=booking.created_at,
                    extra_data={"name": p.name}
                )
                pq.push(pq_entry)
                p.wl_number = len(pq)

        # Determine coach class for fare calculation
        coach_type = "2AC"
        for p in booking.passengers:
            if p.allocated_berth and p.allocated_berth.coach:
                coach_type = p.allocated_berth.coach.coach_type
                break

        fare = cls.calculate_fare_breakdown(coach_type, booking.quota, len(booking.passengers))

        # Record payment
        payment = Payment(
            booking_id=booking.id,
            amount=fare["total_fare"],
            status="SUCCESS"
        )
        db.add(payment)
        db.commit()

        # Update DSA Hash Table
        dsa_manager.pnr_table.insert(pnr, {
            "pnr": pnr,
            "train_run_id": booking.train_run_id,
            "status": booking.booking_status,
            "passengers": [p.name for p in booking.passengers],
            "confirmed_at": str(now)
        })

        return cls.format_booking_response(booking, booking.passengers)

    @classmethod
    def cancel_reservation(cls, db: Session, pnr: str, passenger_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Cancels a booking or specific passenger and promotes next waitlisted passenger.
        1. Release associated berth.
        2. Identify highest-priority eligible passenger from priority queue.
        3. Allocate berth to promoted passenger.
        """
        booking = db.query(Booking).filter(Booking.pnr == pnr).first()
        if not booking:
            raise ValueError(f"Booking {pnr} not found.")

        passengers_to_cancel = [p for p in booking.passengers if passenger_id is None or p.id == passenger_id]
        if not passengers_to_cancel:
            raise ValueError("No matching passengers found to cancel.")

        pq = dsa_manager.get_priority_queue(booking.train_run_id)
        promoted_passengers = []

        for p in passengers_to_cancel:
            if p.status == "CANCELLED":
                continue

            allocated_berth_id = p.allocated_berth_id
            p.status = "CANCELLED"
            p.allocated_berth_id = None

            if allocated_berth_id:
                berth = db.query(Berth).filter(Berth.id == allocated_berth_id).first()
                # Check for automatic promotion from Priority Queue
                if not pq.is_empty():
                    top_candidate: PriorityQueueEntry = pq.pop()
                    promoted_p = db.query(Passenger).filter(Passenger.id == top_candidate.passenger_id).first()
                    if promoted_p:
                        promoted_p.status = "CNF"
                        promoted_p.allocated_berth_id = berth.id
                        promoted_p.wl_number = None
                        berth.current_status = "CONFIRMED"
                        berth.active_booking_id = promoted_p.booking_id
                        promoted_passengers.append({
                            "promoted_passenger_id": promoted_p.id,
                            "promoted_pnr": top_candidate.pnr,
                            "new_status": "CNF",
                            "berth_id": berth.id
                        })
                else:
                    # No waitlist passenger; berth becomes available
                    berth.current_status = "AVAILABLE"
                    berth.active_booking_id = None
            else:
                # Cancelled passenger was in waitlist: remove from Priority Queue
                pq.remove_by_passenger_id(p.id)

        # Check if entire booking is cancelled
        active_remaining = [p for p in booking.passengers if p.status != "CANCELLED"]
        if not active_remaining:
            booking.booking_status = "CANCELLED"

        db.commit()

        # Update Hash Table
        dsa_manager.pnr_table.insert(pnr, {
            "pnr": pnr,
            "train_run_id": booking.train_run_id,
            "status": booking.booking_status,
            "active_passengers": len(active_remaining)
        })

        return {
            "pnr": pnr,
            "cancelled_count": len(passengers_to_cancel),
            "promotions_triggered": promoted_passengers,
            "booking_status": booking.booking_status
        }

    @classmethod
    def cleanup_expired_holds(cls, db: Session) -> int:
        """Finds any HELD bookings where held_until has passed and releases them."""
        now = datetime.datetime.utcnow()
        expired = (
            db.query(Booking)
            .filter(
                Booking.booking_status.in_(["HELD", "HELD_WL"]),
                Booking.held_until < now
            )
            .all()
        )
        count = 0
        for b in expired:
            cls._release_held_booking(db, b, "EXPIRED")
            count += 1
        if count > 0:
            db.commit()
        return count

    @classmethod
    def _release_held_booking(cls, db: Session, booking: Booking, reason: str):
        booking.booking_status = reason
        for p in booking.passengers:
            if p.allocated_berth_id:
                berth = db.query(Berth).filter(Berth.id == p.allocated_berth_id).first()
                if berth and berth.current_status == "HELD":
                    berth.current_status = "AVAILABLE"
                    berth.active_booking_id = None
            p.status = reason

    @staticmethod
    def format_booking_response(booking: Booking, passengers: List[Passenger]) -> Dict[str, Any]:
        p_res = []
        for p in passengers:
            coach_code = None
            berth_num = None
            berth_type = None
            if p.allocated_berth:
                coach_code = p.allocated_berth.coach.coach_code if p.allocated_berth.coach else None
                berth_num = p.allocated_berth.berth_number
                berth_type = p.allocated_berth.berth_type

            p_res.append({
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "status": p.status,
                "coach_code": coach_code,
                "berth_number": berth_num,
                "berth_type": berth_type,
                "rac_number": p.rac_number,
                "wl_number": p.wl_number
            })

        coach_type = "2AC"
        for p in passengers:
            if p.allocated_berth and p.allocated_berth.coach:
                coach_type = p.allocated_berth.coach.coach_type
                break

        fare = ReservationService.calculate_fare_breakdown(coach_type, booking.quota, len(passengers))

        return {
            "pnr": booking.pnr,
            "train_run_id": booking.train_run_id,
            "booking_status": booking.booking_status,
            "quota": booking.quota,
            "total_passengers": len(passengers),
            "held_until": str(booking.held_until) if booking.held_until else None,
            "created_at": str(booking.created_at),
            "fare_breakdown": fare,
            "passengers": p_res
        }

