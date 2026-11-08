from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.entities import TrainRun, Coach, Berth, Passenger
from app.dsa.sorting import merge_sort_chart
from app.services.dsa_manager import dsa_manager

router = APIRouter(prefix="/chart", tags=["Reservation Chart"])

@router.get("/{train_run_id}")
def get_sorted_reservation_chart(train_run_id: int, db: Session = Depends(get_db)):
    """
    Academic DSA Requirement 3.7:
    Reservation chart sorting ordered by:
    1. Coach identifier ascending (e.g. A1, B1, S1)
    2. Berth number ascending
    
    Explicitly uses custom in-place / stable Merge Sort (NOT SQL ORDER BY).
    """
    run = db.query(TrainRun).filter(TrainRun.id == train_run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Train run not found")

    # Fetch unsorted raw records
    berths = (
        db.query(Berth)
        .join(Coach, Berth.coach_id == Coach.id)
        .filter(Coach.train_run_id == train_run_id)
        .all()
    )

    raw_records = []
    for b in berths:
        passenger_name = "VACANT"
        status = b.current_status
        p_age = None
        p_gender = None
        quota = None

        if b.active_booking_id:
            p = db.query(Passenger).filter(Passenger.allocated_berth_id == b.id).first()
            if p:
                passenger_name = p.name
                status = p.status
                p_age = p.age
                p_gender = p.gender
                quota = p.booking.quota if p.booking else None

        raw_records.append({
            "coach_code": b.coach.coach_code,
            "coach_type": b.coach.coach_type,
            "berth_number": b.berth_number,
            "berth_type": b.berth_type,
            "status": status,
            "passenger_name": passenger_name,
            "age": p_age,
            "gender": p_gender,
            "quota": quota
        })

    # Sort using custom academic merge sort
    sorted_chart = merge_sort_chart(raw_records)

    # Get waitlist from Priority Queue for this run
    pq = dsa_manager.get_priority_queue(train_run_id)
    waitlist_snapshot = []
    for entry in pq.to_list():
        waitlist_snapshot.append({
            "pnr": entry.pnr,
            "passenger_id": entry.passenger_id,
            "quota": entry.quota,
            "age": entry.age,
            "timestamp": str(entry.timestamp)
        })

    return {
        "train_number": run.train.train_number,
        "train_name": run.train.train_name,
        "run_date": str(run.run_date),
        "total_berths": len(sorted_chart),
        "sorted_chart": sorted_chart,
        "waiting_list": waitlist_snapshot,
        "sorting_algorithm_used": "Custom Academic Stable Merge Sort (Time: O(N log N), Space: O(N))"
    }

