from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.services.dsa_manager import dsa_manager
from app.models.entities import Booking
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/pnr", tags=["PNR Status & DSA Query"])

@router.get("/{pnr}")
def get_pnr_status(pnr: str, db: Session = Depends(get_db)):
    """
    Demonstrates Academic DSA Requirement 3.4 & 4.1:
    1. Bloom Filter Probabilistic Pre-Check (O(k))
       - If Bloom Filter returns False: Guaranteed NOT FOUND. Skip database and hash table search!
    2. Custom PNR Hash Table Lookup (O(1) average)
    3. Fallback database verification & state hydration
    """
    clean_pnr = str(pnr).strip().upper()
    bloom_check = dsa_manager.bloom_filter.contains(clean_pnr)
    if not bloom_check:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"PNR {clean_pnr} definitively absent from system.",
                "bloom_filter_pre_check": False,
                "dsa_optimization": "Fast-path rejection without DB query"
            }
        )

    # Search custom hash table
    ht_entry = dsa_manager.pnr_table.search(clean_pnr)

    # Also retrieve full booking entity for complete details
    booking = db.query(Booking).filter(Booking.pnr == clean_pnr).first()
    if not booking:
        # This was a false positive from Bloom filter!
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"PNR {clean_pnr} not found in database.",
                "bloom_filter_pre_check": True,
                "note": "Probabilistic Bloom Filter produced a false positive (resolved by hash table)."
            }
        )

    response = ReservationService.format_booking_response(booking, booking.passengers)
    response["dsa_audit"] = {
        "bloom_filter_pre_check": True,
        "hash_table_hit": ht_entry is not None,
        "hash_table_metrics": dsa_manager.pnr_table.get_metrics(),
        "bloom_filter_metrics": dsa_manager.bloom_filter.get_metrics()
    }
    return response

