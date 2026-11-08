import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.connection import Base
from app.models.entities import Train, TrainRun, Coach, Berth, Booking, Passenger
from app.services.reservation_service import ReservationService
from app.schemas.schemas import BookingCreate, PassengerCreate
from app.services.dsa_manager import dsa_manager

TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture
def test_db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    # Create dummy train with 1 coach of 2 berths
    train = Train(train_number="TEST01", train_name="Test Express", source_station="A", destination_station="B")
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

def test_booking_and_payment_flow(test_db):
    req = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[
            PassengerCreate(name="Alice", age=28, gender="F"),
            PassengerCreate(name="Bob", age=32, gender="M")
        ]
    )
    # 1. Hold
    hold_res = ReservationService.create_booking_hold(test_db, req)
    pnr = hold_res["pnr"]
    assert hold_res["booking_status"] == "HELD"
    assert len(hold_res["passengers"]) == 2
    assert hold_res["passengers"][0]["status"] == "HELD_CNF"

    # 2. Confirm Payment
    confirm_res = ReservationService.confirm_payment(test_db, pnr, simulate_success=True)
    assert confirm_res["booking_status"] == "CONFIRMED"
    assert confirm_res["passengers"][0]["status"] == "CNF"

def test_waiting_list_and_promotion(test_db):
    # Book all 2 berths first
    req1 = BookingCreate(
        train_run_id=1,
        quota="GN",
        passengers=[
            PassengerCreate(name="P1", age=25, gender="M"),
            PassengerCreate(name="P2", age=30, gender="F")
        ]
    )
    res1 = ReservationService.create_booking_hold(test_db, req1)
    ReservationService.confirm_payment(test_db, res1["pnr"])

    # Now train is FULL. Next booking should get HELD_WL -> WL
    req2 = BookingCreate(
        train_run_id=1,
        quota="SS", # Senior Citizen priority!
        passengers=[
            PassengerCreate(name="Senior Citizen", age=72, gender="M")
        ]
    )
    res2 = ReservationService.create_booking_hold(test_db, req2)
    assert res2["passengers"][0]["status"] == "HELD_WL"

    res2_confirmed = ReservationService.confirm_payment(test_db, res2["pnr"])
    assert res2_confirmed["passengers"][0]["status"] == "WL"

    # Now cancel P1 from the confirmed booking
    cancel_res = ReservationService.cancel_reservation(test_db, res1["pnr"])
    assert len(cancel_res["promotions_triggered"]) == 1
    promoted = cancel_res["promotions_triggered"][0]
    assert promoted["promoted_pnr"] == res2["pnr"]
    assert promoted["new_status"] == "CNF"

