import json
from typing import Optional
from sqlalchemy.orm import Session
from app.models.entities import IdempotencyRecord

class IdempotencyService:
    @staticmethod
    def get_record(db: Session, key: str) -> Optional[IdempotencyRecord]:
        if not key:
            return None
        return db.query(IdempotencyRecord).filter(IdempotencyRecord.key == key).first()

    @staticmethod
    def save_record(db: Session, key: str, request_hash: str, response_body: dict, status_code: int = 200) -> IdempotencyRecord:
        record = IdempotencyRecord(
            key=key,
            request_hash=request_hash,
            response_body=json.dumps(response_body),
            status_code=status_code
        )
        db.add(record)
        db.commit()
        return record

