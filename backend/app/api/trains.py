from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database.connection import get_db
from app.models.entities import Train, TrainRun, Coach, Berth

router = APIRouter(prefix="/trains", tags=["Trains"])

@router.get("/")
def list_trains(db: Session = Depends(get_db)):
    trains = db.query(Train).all()
    res = []
    for t in trains:
        runs = []
        for r in t.runs:
            # Count available berths
            avail_count = (
                db.query(Berth)
                .join(Coach, Berth.coach_id == Coach.id)
                .filter(Coach.train_run_id == r.id, Berth.current_status == "AVAILABLE")
                .count()
            )
            total_berths = (
                db.query(Berth)
                .join(Coach, Berth.coach_id == Coach.id)
                .filter(Coach.train_run_id == r.id)
                .count()
            )
            runs.append({
                "run_id": r.id,
                "run_date": str(r.run_date),
                "status": r.status,
                "available_berths": avail_count,
                "total_berths": total_berths
            })
        res.append({
            "id": t.id,
            "train_number": t.train_number,
            "train_name": t.train_name,
            "source_station": t.source_station,
            "destination_station": t.destination_station,
            "runs": runs
        })
    return res

@router.get("/{train_run_id}/layout")
def get_train_run_layout(train_run_id: int, db: Session = Depends(get_db)):
    run = db.query(TrainRun).filter(TrainRun.id == train_run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Train run not found")
        
    coaches_data = []
    for coach in run.coaches:
        berths_data = []
        for b in coach.berths:
            berths_data.append({
                "id": b.id,
                "berth_number": b.berth_number,
                "berth_type": b.berth_type,
                "status": b.current_status
            })
        coaches_data.append({
            "coach_code": coach.coach_code,
            "coach_type": coach.coach_type,
            "total_berths": coach.total_berths,
            "berths": berths_data
        })
        
    return {
        "train_number": run.train.train_number,
        "train_name": run.train.train_name,
        "run_date": str(run.run_date),
        "coaches": coaches_data
    }

