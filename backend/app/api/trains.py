from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import datetime
from app.database.connection import get_db
from app.models.entities import Train, TrainRun, Coach, Berth
from app.schemas.schemas import TrainCreateRequest

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

@router.post("/", status_code=201)
def create_train(req: TrainCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(Train).filter(Train.train_number == req.train_number.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Train with number {req.train_number} already exists.")

    default_coaches = req.coaches or [
        {"coach_code": "A1", "coach_type": "2AC", "total_berths": 8},
        {"coach_code": "B1", "coach_type": "3AC", "total_berths": 12},
        {"coach_code": "S1", "coach_type": "SL", "total_berths": 16},
    ]

    new_train = Train(
        train_number=req.train_number.strip(),
        train_name=req.train_name.strip(),
        source_station=req.source_station.strip(),
        destination_station=req.destination_station.strip(),
        total_coaches=len(default_coaches)
    )
    db.add(new_train)
    db.flush()

    berth_types = ["LOWER", "MIDDLE", "UPPER", "SIDE_LOWER", "SIDE_UPPER"]

    for d_str in req.run_dates:
        try:
            r_date = datetime.date.fromisoformat(d_str.strip())
        except ValueError:
            continue

        run = TrainRun(
            train_id=new_train.id,
            run_date=r_date,
            status="SCHEDULED"
        )
        db.add(run)
        db.flush()

        for c_info in default_coaches:
            c_code = c_info.coach_code if hasattr(c_info, "coach_code") else c_info["coach_code"]
            c_type = c_info.coach_type if hasattr(c_info, "coach_type") else c_info["coach_type"]
            c_berths = c_info.total_berths if hasattr(c_info, "total_berths") else c_info["total_berths"]

            coach = Coach(
                train_run_id=run.id,
                coach_code=c_code,
                coach_type=c_type,
                total_berths=c_berths
            )
            db.add(coach)
            db.flush()

            for b_num in range(1, c_berths + 1):
                b_type = berth_types[(b_num - 1) % len(berth_types)]
                berth = Berth(
                    coach_id=coach.id,
                    berth_number=b_num,
                    berth_type=b_type,
                    current_status="AVAILABLE"
                )
                db.add(berth)

    db.commit()
    db.refresh(new_train)

    return {
        "id": new_train.id,
        "train_number": new_train.train_number,
        "train_name": new_train.train_name,
        "source_station": new_train.source_station,
        "destination_station": new_train.destination_station,
        "total_coaches": new_train.total_coaches,
        "runs_created": len(new_train.runs)
    }

@router.delete("/{train_id}")
def delete_train(train_id: int, db: Session = Depends(get_db)):
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train not found")
    train_num = train.train_number
    db.delete(train)
    db.commit()
    return {"message": f"Train {train_num} and all associated runs deleted successfully."}


