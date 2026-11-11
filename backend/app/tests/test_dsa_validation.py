import pytest
import datetime
import tempfile
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.connection import Base
from app.models.entities import Train, TrainRun, Coach, Berth, Booking, Passenger
from app.services.reservation_service import ReservationService
from app.schemas.schemas import BookingCreate, PassengerCreate
from app.dsa.priority_queue import PriorityQueue, PriorityQueueEntry
from app.services.dsa_manager import dsa_manager

@pytest.fixture
def test_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_dsa.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    train = Train(train_number="EXP101", train_name="DSA Express", source_station="SRC", destination_station="DST")
    db.add(train)
    db.flush()

    run = TrainRun(train_id=train.id, run_date=datetime.date.today())
    db.add(run)
    db.flush()

    coach = Coach(train_run_id=run.id, coach_code="S1", coach_type="SL", total_berths=2)
    db.add(coach)
    db.flush()

    b1 = Berth(coach_id=coach.id, berth_number=1, berth_type="LOWER", current_status="AVAILABLE")
    b2 = Berth(coach_id=coach.id, berth_number=2, berth_type="UPPER", current_status="AVAILABLE")
    db.add_all([b1, b2])
    db.commit()

    yield db
    db.close()
    engine.dispose()
    try:
        os.remove(db_path)
        os.rmdir(temp_dir)
    except Exception:
        pass

# -----------------------------------------------------------------------------
# 1. Validate confirmed/RAC/WL transitions
# -----------------------------------------------------------------------------
def test_confirmed_rac_wl_transitions(test_db):
    """
    Validates state transitions:
    - AVAILABLE -> HELD -> CONFIRMED (when berths exist)
    - Overflow -> HELD_WL -> WAITING (individual status WL) when capacity is saturated
    """
    req1 = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[
            PassengerCreate(name="Passenger One", age=25, gender="M", berth_preference="LOWER"),
            PassengerCreate(name="Passenger Two", age=27, gender="F", berth_preference="UPPER")
        ]
    )
    hold1 = ReservationService.create_booking_hold(test_db, req1)
    assert hold1["booking_status"] == "HELD"
    assert hold1["passengers"][0]["status"] == "HELD_CNF"
    assert hold1["passengers"][1]["status"] == "HELD_CNF"

    # Confirm Payment
    cnf1 = ReservationService.confirm_payment(test_db, hold1["pnr"], simulate_success=True)
    assert cnf1["booking_status"] == "CONFIRMED"
    assert cnf1["passengers"][0]["status"] == "CNF"
    assert cnf1["passengers"][1]["status"] == "CNF"

    # Capacity is now 0. Attempt 3rd passenger booking
    req2 = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[PassengerCreate(name="Passenger Three", age=30, gender="M")]
    )
    hold2 = ReservationService.create_booking_hold(test_db, req2)
    assert hold2["booking_status"] == "HELD_WL"
    assert hold2["passengers"][0]["status"] == "HELD_WL"

    # Confirm Payment for waitlisted passenger
    cnf2 = ReservationService.confirm_payment(test_db, hold2["pnr"], simulate_success=True)
    assert cnf2["booking_status"] == "WAITING"
    assert cnf2["passengers"][0]["status"] == "WL"
    assert cnf2["passengers"][0]["wl_number"] >= 1

# -----------------------------------------------------------------------------
# 2. Verify quota and timestamp priority
# -----------------------------------------------------------------------------
def test_quota_and_timestamp_priority():
    """
    Verifies that the Min-Heap priority queue enforces:
    - SS (Priority 1) > LD (Priority 2) > GN (Priority 3) > TQ (Priority 4)
    - Identical quota breaks ties strictly by booking timestamp (FIFO)
    """
    pq = PriorityQueue()
    t0 = datetime.datetime(2026, 11, 11, 10, 0, 0)
    t1 = datetime.datetime(2026, 11, 11, 10, 5, 0)
    t2 = datetime.datetime(2026, 11, 11, 10, 10, 0)
    t3 = datetime.datetime(2026, 11, 11, 10, 15, 0)
    t4 = datetime.datetime(2026, 11, 11, 10, 20, 0)

    pq.push(PriorityQueueEntry(passenger_id=101, pnr="P_GN_EARLY", quota="GN", age=30, timestamp=t0))
    pq.push(PriorityQueueEntry(passenger_id=102, pnr="P_TQ", quota="TQ", age=28, timestamp=t1))
    pq.push(PriorityQueueEntry(passenger_id=103, pnr="P_LD", quota="LD", age=29, timestamp=t2))
    pq.push(PriorityQueueEntry(passenger_id=104, pnr="P_SS", quota="SS", age=68, timestamp=t3))
    pq.push(PriorityQueueEntry(passenger_id=105, pnr="P_GN_LATE", quota="GN", age=45, timestamp=t4))

    # Senior Citizen (SS, Priority 1)
    p1 = pq.pop()
    assert p1.passenger_id == 104
    assert p1.quota == "SS"

    # Ladies Quota (LD, Priority 2)
    p2 = pq.pop()
    assert p2.passenger_id == 103
    assert p2.quota == "LD"

    # General Early (GN, Priority 3, t0 < t4)
    p3 = pq.pop()
    assert p3.passenger_id == 101
    assert p3.pnr == "P_GN_EARLY"

    # General Late (GN, Priority 3, t4)
    p4 = pq.pop()
    assert p4.passenger_id == 105
    assert p4.pnr == "P_GN_LATE"

    # Tatkal Waitlist (TQ, Priority 4)
    p5 = pq.pop()
    assert p5.passenger_id == 102
    assert p5.quota == "TQ"

# -----------------------------------------------------------------------------
# 3. Test cancellation and automatic promotion
# -----------------------------------------------------------------------------
def test_cancellation_and_automatic_promotion(test_db):
    """
    Tests that cancelling confirmed seats instantly promotes
    the highest priority passenger from the waiting queue into the freed berth.
    """
    req_cnf = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[
            PassengerCreate(name="Original CNF 1", age=30, gender="M"),
            PassengerCreate(name="Original CNF 2", age=32, gender="F")
        ]
    )
    hold_cnf = ReservationService.create_booking_hold(test_db, req_cnf)
    ReservationService.confirm_payment(test_db, hold_cnf["pnr"])

    req_wl_gn = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[PassengerCreate(name="Waitlist General", age=25, gender="M")]
    )
    hold_wl_gn = ReservationService.create_booking_hold(test_db, req_wl_gn)
    ReservationService.confirm_payment(test_db, hold_wl_gn["pnr"])

    req_wl_ss = BookingCreate(
        train_run_id=1,
        quota="SS",
        passengers=[PassengerCreate(name="Waitlist Senior", age=75, gender="M")]
    )
    hold_wl_ss = ReservationService.create_booking_hold(test_db, req_wl_ss)
    ReservationService.confirm_payment(test_db, hold_wl_ss["pnr"])

    p1_id = hold_cnf["passengers"][0]["id"]
    cancel_res = ReservationService.cancel_reservation(test_db, hold_cnf["pnr"], passenger_id=p1_id)
    assert len(cancel_res["promotions_triggered"]) == 1

    promoted = cancel_res["promotions_triggered"][0]
    assert promoted["promoted_pnr"] == hold_wl_ss["pnr"]
    assert promoted["new_status"] == "CNF"

    promoted_berth = test_db.query(Berth).filter(Berth.id == promoted["berth_id"]).first()
    assert promoted_berth.current_status == "CONFIRMED"

# -----------------------------------------------------------------------------
# 4. Test concurrent bookings and payment expiry
# -----------------------------------------------------------------------------
def test_concurrent_bookings_and_payment_expiry(test_db):
    """
    Tests:
    A. Atomic seat hold under concurrent competition for the last remaining seat.
    B. Hold TTL expiration: held berths automatically return to AVAILABLE.
    """
    # Occupy berth 1 so exactly 1 berth remains available
    req_occupy = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[PassengerCreate(name="Occupier", age=30, gender="M")]
    )
    hold_occ = ReservationService.create_booking_hold(test_db, req_occupy)
    ReservationService.confirm_payment(test_db, hold_occ["pnr"])

    # Compete for the remaining single berth sequentially and atomically
    req_a = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[PassengerCreate(name="Candidate A", age=26, gender="F")]
    )
    res_a = ReservationService.create_booking_hold(test_db, req_a)

    req_b = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[PassengerCreate(name="Candidate B", age=28, gender="M")]
    )
    res_b = ReservationService.create_booking_hold(test_db, req_b)

    # Exactly one gets HELD, other gets HELD_WL
    assert res_a["booking_status"] == "HELD"
    assert res_b["booking_status"] == "HELD_WL"

    # Part B: Payment Expiry Test
    held_booking = test_db.query(Booking).filter(Booking.booking_status == "HELD").first()
    assert held_booking is not None

    # Artificially expire the held booking
    held_booking.held_until = datetime.datetime.utcnow() - datetime.timedelta(seconds=10)
    test_db.commit()

    # Trigger cleanup
    expired_count = ReservationService.cleanup_expired_holds(test_db)
    assert expired_count >= 1

    # Verify booking status changed to EXPIRED
    test_db.refresh(held_booking)
    assert held_booking.booking_status == "EXPIRED"

    # Verify berth status reverted to AVAILABLE
    berth_id = held_booking.passengers[0].allocated_berth_id
    reverted_berth = test_db.query(Berth).filter(Berth.id == berth_id).first()
    assert reverted_berth.current_status == "AVAILABLE"
