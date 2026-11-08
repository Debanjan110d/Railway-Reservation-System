import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric, Text, Float
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Train(Base):
    __tablename__ = "trains"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String(10), unique=True, nullable=False)
    train_name = Column(String(100), nullable=False)
    source_station = Column(String(50), nullable=False)
    destination_station = Column(String(50), nullable=False)
    total_coaches = Column(Integer, default=4)

    runs = relationship("TrainRun", back_populates="train", cascade="all, delete-orphan")


class TrainRun(Base):
    __tablename__ = "train_runs"

    id = Column(Integer, primary_key=True, index=True)
    train_id = Column(Integer, ForeignKey("trains.id"), nullable=False)
    run_date = Column(Date, nullable=False)
    status = Column(String(20), default="SCHEDULED")  # SCHEDULED, RUNNING, COMPLETED, CANCELLED

    train = relationship("Train", back_populates="runs")
    coaches = relationship("Coach", back_populates="train_run", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="train_run")


class Coach(Base):
    __tablename__ = "coaches"

    id = Column(Integer, primary_key=True, index=True)
    train_run_id = Column(Integer, ForeignKey("train_runs.id"), nullable=False)
    coach_code = Column(String(10), nullable=False)  # e.g., B1, B2, S1, S2, A1
    coach_type = Column(String(10), nullable=False)  # 1AC, 2AC, 3AC, SL
    total_berths = Column(Integer, nullable=False)

    train_run = relationship("TrainRun", back_populates="coaches")
    berths = relationship("Berth", back_populates="coach", cascade="all, delete-orphan")


class Berth(Base):
    __tablename__ = "berths"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    berth_number = Column(Integer, nullable=False)
    berth_type = Column(String(15), nullable=False)  # LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER
    current_status = Column(String(20), default="AVAILABLE")  # AVAILABLE, HELD, CONFIRMED, RAC
    active_booking_id = Column(Integer, nullable=True)

    coach = relationship("Coach", back_populates="berths")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    pnr = Column(String(12), unique=True, nullable=False)
    train_run_id = Column(Integer, ForeignKey("train_runs.id"), nullable=False)
    booking_status = Column(String(20), nullable=False)  # HELD, CONFIRMED, RAC, WAITING, CANCELLED
    quota = Column(String(10), default="GN")  # GN, TQ, LD, SS
    total_passengers = Column(Integer, default=1)
    held_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    train_run = relationship("TrainRun", back_populates="bookings")
    passengers = relationship("Passenger", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")


class Passenger(Base):
    __tablename__ = "passengers"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    berth_preference = Column(String(15), nullable=True)
    allocated_berth_id = Column(Integer, ForeignKey("berths.id"), nullable=True)
    status = Column(String(20), nullable=False)  # CNF, RAC, WL, CANCELLED
    rac_number = Column(Integer, nullable=True)
    wl_number = Column(Integer, nullable=True)
    priority_score = Column(Float, default=0.0)

    booking = relationship("Booking", back_populates="passengers")
    allocated_berth = relationship("Berth")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    idempotency_key = Column(String(64), unique=True, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), nullable=False)  # INITIATED, SUCCESS, FAILED, REFUNDED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("Booking", back_populates="payments")


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    key = Column(String(64), primary_key=True)
    request_hash = Column(String(64), nullable=False)
    response_body = Column(Text, nullable=False)
    status_code = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

