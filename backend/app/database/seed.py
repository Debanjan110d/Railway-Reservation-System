import datetime
from sqlalchemy.orm import Session
from app.models.entities import Train, TrainRun, Coach, Berth
from app.database.connection import engine, Base, SessionLocal

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Train).count() > 0:
            print("Database already seeded.")
            return

        print("Seeding Indian Railway demo trains and coaches...")
        
        # Train 1: 12301 Rajdhani Express
        rajdhani = Train(
            train_number="12301",
            train_name="Rajdhani Express",
            source_station="Howrah (HWH)",
            destination_station="New Delhi (NDLS)",
            total_coaches=3
        )
        # Train 2: 12002 Shatabdi Express
        shatabdi = Train(
            train_number="12002",
            train_name="Bhopal Shatabdi Express",
            source_station="New Delhi (NDLS)",
            destination_station="Rani Kamalapati (RKMP)",
            total_coaches=3
        )
        db.add_all([rajdhani, shatabdi])
        db.flush()

        today = datetime.date.today()
        # Create runs for next 3 days
        for t in [rajdhani, shatabdi]:
            for day_offset in range(3):
                run_date = today + datetime.timedelta(days=day_offset)
                run = TrainRun(
                    train_id=t.id,
                    run_date=run_date,
                    status="SCHEDULED"
                )
                db.add(run)
                db.flush()

                # Add coaches: A1 (2AC), B1 (3AC), S1 (Sleeper)
                # Keep modest berth count (12 berths per coach) to allow quick demonstration
                # of full occupation, RAC, and Waitlist handling in academic simulations
                coaches_config = [
                    ("A1", "2AC", 8),
                    ("B1", "3AC", 12),
                    ("S1", "SL", 16)
                ]
                berth_types = ["LOWER", "MIDDLE", "UPPER", "SIDE_LOWER", "SIDE_UPPER"]

                for c_code, c_type, total_berths in coaches_config:
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
        print("Database successfully initialized and seeded with Trains, Runs, Coaches, and Berths!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

