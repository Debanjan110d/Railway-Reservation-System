import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Railway Reservation System (DSA Core)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # SQLite fallback by default for local execution without external DB daemon,
    # or can connect to PostgreSQL using DATABASE_URL env var
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./railway.db")
    
    # Hold expiration configuration (5 minutes)
    SEAT_HOLD_DURATION_SECONDS: int = 300
    
    # Custom DSA Parameters
    PNR_HASH_INITIAL_CAPACITY: int = 64
    BLOOM_FILTER_EXPECTED_ELEMENTS: int = 10000
    BLOOM_FILTER_FP_PROB: float = 0.01

    class Config:
        case_sensitive = True

settings = Settings()

