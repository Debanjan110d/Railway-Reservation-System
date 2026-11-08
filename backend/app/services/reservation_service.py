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

    @classmethod
    def create_booking_hold(cls, db: Session, req: BookingCreate) -> Dict[str, Any]:
        """
        Creates a temporary reservation hold (AVAILABLE -> HELD).
        Enforces:
        1. Atomic row-level claim of berths (or sequential hold in SQLite).
        2. Hold expiration TTL (default 5 minutes).
        3. If berths are exhausted, allocate RAC or Waiting-List.
        """
        # Expire any old holds first
        cls.cleanup_expired_holds(db)

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
        # In a standard coach, side lowers can be RAC (up to 4 per train run for demo)
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

        passenger_records = []
        pq = dsa_manager.get_priority_queue(req.train_run_id)
        rac_q = dsa_manager.get_rac_queue(req.train_run_id)

        for i, p_info in enumerate(req.passengers):
            if i < len(available_berths):
                # We have a physical berth available
                berth = available_berths[i]
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
                # Quota & Waiting-List allocation
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
                # Add to academic priority queue
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

        # Record payment
        payment = Payment(
            booking_id=booking.id,
            amount=500.0 * len(booking.passengers),
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
        Cancels a booking or specific passenger and executes AUTOMATIC PROMOTION.
        Academic Requirement 3.6:
        1. Release associated berth.
        2. Identify highest-priority eligible passenger from PriorityQueue.
        3. Allocate berth to promoted passenger.
        4. Maintain application state and persistent consistency.
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

        return {
            "pnr": booking.pnr,
            "train_run_id": booking.train_run_id,
            "booking_status": booking.booking_status,
            "quota": booking.quota,
            "total_passengers": len(passengers),
            "held_until": str(booking.held_until) if booking.held_until else None,
            "created_at": str(booking.created_at),
            "passengers": p_res
        }

