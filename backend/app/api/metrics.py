from fastapi import APIRouter
from app.services.dsa_manager import dsa_manager

router = APIRouter(prefix="/metrics", tags=["DSA Metrics & Complexity Inspection"])

@router.get("/dsa")
def get_dsa_metrics():
    """
    Exposes real-time structural health and metrics of all custom DSA implementations:
    - Custom PNR Hash Table (size, capacity, load factor, collisions, resizes)
    - Bloom Filter (bit array size m, k hashes, bits set, saturation, theoretical false positive rate)
    - Active Priority Queues and Queues count
    """
    return {
        "hash_table": dsa_manager.pnr_table.get_metrics(),
        "bloom_filter": dsa_manager.bloom_filter.get_metrics(),
        "active_waitlist_heaps": len(dsa_manager.train_waiting_heaps),
        "active_rac_queues": len(dsa_manager.train_rac_queues)
    }

