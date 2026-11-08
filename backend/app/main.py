from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.connection import engine, Base, SessionLocal
from app.models.entities import Booking
from app.services.dsa_manager import dsa_manager
from app.api import trains, bookings, pnr, chart, metrics

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Academic Railway Reservation System with Custom Data Structures & Priority Engine"
)

# Enable CORS for Frontend React integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(trains.router, prefix=settings.API_V1_STR)
app.include_router(bookings.router, prefix=settings.API_V1_STR)
app.include_router(pnr.router, prefix=settings.API_V1_STR)
app.include_router(chart.router, prefix=settings.API_V1_STR)
app.include_router(metrics.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_rebuild_dsa_indices():
    """
    On server startup, hydrates the custom PNR Hash Table and Bloom Filter
    from the persistent database to maintain consistency.
    """
    db = SessionLocal()
    try:
        all_bookings = db.query(Booking).all()
        for b in all_bookings:
            dsa_manager.pnr_table.insert(b.pnr, {
                "pnr": b.pnr,
                "train_run_id": b.train_run_id,
                "status": b.booking_status
            })
            dsa_manager.bloom_filter.add(b.pnr)
        print(f"Startup complete: Hydrated {len(all_bookings)} bookings into custom DSA structures.")
    finally:
        db.close()

@app.get("/")
def root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "dsa_features": [
            "Custom PNR Hash Table with Separate Chaining & Load Factor Resizing",
            "Probabilistic Bloom Filter with Kirsch-Mitzenmacher Double Hashing",
            "Custom Binary Min-Heap Priority Queue for Quota & Waiting-List Prioritization",
            "Custom Doubly Linked List FIFO Queue for RAC",
            "Custom In-Place/Stable Merge Sort for Multi-Level Reservation Chart Sorting"
        ]
    }

