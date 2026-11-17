import sys
import os
from pathlib import Path
import datetime

# Ensure stdout handles unicode cleanly across Windows cp1252 / UTF-8
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is on sys.path regardless of execution working directory
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.models.entities import Train, TrainRun, Coach, Berth, Booking, Passenger
from app.database.connection import engine, Base, SessionLocal

def reset_and_seed_database():
    """
    Completely cleans old dummy bookings and seeds realistic West Bengal / Kolkata
    originating and terminating trains with clean coach layouts.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("[*] Clearing all old bookings and passengers...")
        db.query(Passenger).delete()
        db.query(Booking).delete()
        db.query(Berth).delete()
        db.query(Coach).delete()
        db.query(TrainRun).delete()
        db.query(Train).delete()
        db.commit()

        print("[*] Seeding West Bengal & Kolkata Railway Fleet...")

        kolkata_trains = [
            {
                "train_number": "12301",
                "train_name": "Howrah - New Delhi Rajdhani Express",
                "source": "Howrah (HWH)",
                "destination": "New Delhi (NDLS)",
                "coaches": [("A1", "2AC", 8), ("B1", "3AC", 12), ("S1", "SL", 16)]
            },
            {
                "train_number": "22301",
                "train_name": "Howrah - New Jalpaiguri Vande Bharat Express",
                "source": "Howrah (HWH)",
                "destination": "New Jalpaiguri (NJP)",
                "coaches": [("C1", "CC", 12), ("E1", "EC", 8)]
            }
        ]

        today = datetime.date.today()
        berth_types = ["LOWER", "MIDDLE", "UPPER", "SIDE_LOWER", "SIDE_UPPER"]

        for t_data in kolkata_trains:
            train = Train(
                train_number=t_data["train_number"],
                train_name=t_data["train_name"],
                source_station=t_data["source"],
                destination_station=t_data["destination"],
                total_coaches=len(t_data["coaches"])
            )
            db.add(train)
            db.flush()

            # Create scheduled runs for next 4 days
            for day_offset in range(4):
                run_date = today + datetime.timedelta(days=day_offset)
                run = TrainRun(
                    train_id=train.id,
                    run_date=run_date,
                    status="SCHEDULED"
                )
                db.add(run)
                db.flush()

                for c_code, c_type, total_berths in t_data["coaches"]:
                    coach = Coach(
                        train_run_id=run.id,
                        coach_code=c_code,
                        coach_type=c_type,
                        total_berths=total_berths
                    )
                    db.add(coach)
                    db.flush()

                    for b_num in range(1, total_berths + 1):
                        b_type = berth_types[(b_num - 1) % len(berth_types)]
                        berth = Berth(
                            coach_id=coach.id,
                            berth_number=b_num,
                            berth_type=b_type,
                            current_status="AVAILABLE"
                        )
                        db.add(berth)

        db.commit()
        print("[OK] Database successfully reset and seeded with Kolkata & West Bengal Trains!")
        print(f"[OK] Total Trains: {len(kolkata_trains)} | Total Dummy Bookings: 0 (All Berths 100% Available)")
    finally:
        db.close()

def seed_database():
    """Default entrypoint called by scripts and launchers."""
    db = SessionLocal()
    try:
        # If trains exist, check if they are already the Kolkata trains
        hwh_train = db.query(Train).filter(Train.train_number == "22301").first()
        if hwh_train and db.query(Booking).count() == 0:
            print("Database already seeded with West Bengal trains and zero dummy bookings.")
            return
        # Otherwise, re-seed cleanly
        reset_and_seed_database()
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_seed_database()
