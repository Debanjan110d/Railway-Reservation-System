import time
import random
import datetime
from typing import List, Dict, Any
from app.database.connection import SessionLocal
from app.models.entities import TrainRun
from app.schemas.schemas import BookingCreate, PassengerCreate
from app.services.reservation_service import ReservationService
from app.services.dsa_manager import dsa_manager
from app.dsa.sorting import merge_sort_chart

class SimulationRunner:
    """
    Academic DSA Simulation Runner for Phase 5:
    Executes 1,000+ booking and cancellation events across multiple trains and quotas,
    measuring execution time, collision frequency, load factor, and sorting performance.
    """

    def __init__(self, target_events: int = 1000):
        self.target_events = target_events
        self.db = SessionLocal()
        self.created_pnrs: List[str] = []
        self.confirmed_pnrs: List[str] = []
        
        # Performance Tracking Metrics
        self.stats = {
            "total_events": 0,
            "successful_holds": 0,
            "successful_confirmations": 0,
            "failed_payments": 0,
            "cancellations": 0,
            "promotions_triggered": 0,
            "pnr_lookups": 0,
            "bloom_rejections": 0,
            "bloom_hits": 0,
            "hash_table_lookups_time_ms": 0.0,
            "sorting_events": 0,
            "sorting_time_ms": 0.0,
            "start_time": 0.0,
            "end_time": 0.0
        }

    def run(self) -> Dict[str, Any]:
        print(f"[*] Starting academic DSA simulation with {self.target_events} events...")
        self.stats["start_time"] = time.perf_counter()

        # Fetch active train runs
        train_runs = self.db.query(TrainRun).all()
        if not train_runs:
            raise RuntimeError("No train runs found in database. Please run seed script first.")

        run_ids = [r.id for r in train_runs]
        quotas = ["GN", "SS", "LD", "TQ"]
        genders = ["M", "F"]
        names = ["Aarav", "Priya", "Rahul", "Ananya", "Rohan", "Sneha", "Vikram", "Pooja", "Amit", "Neha"]

        for event_idx in range(1, self.target_events + 1):
            action_type = random.choices(
                ["BOOK", "PAY", "CANCEL", "LOOKUP_PNR", "SORT_CHART"],
                weights=[0.40, 0.25, 0.15, 0.15, 0.05],
                k=1
            )[0]

            if action_type == "BOOK":
                train_run_id = random.choice(run_ids)
                quota = random.choice(quotas)
                num_passengers = random.randint(1, 3)

                passengers = []
                for p_i in range(num_passengers):
                    age = random.randint(60, 80) if quota == "SS" else random.randint(18, 55)
                    gender = "F" if quota == "LD" else random.choice(genders)
                    passengers.append(PassengerCreate(
                        name=f"{random.choice(names)}_{event_idx}_{p_i}",
                        age=age,
                        gender=gender
                    ))

                req = BookingCreate(train_run_id=train_run_id, quota=quota, passengers=passengers)
                try:
                    res = ReservationService.create_booking_hold(self.db, req)
                    self.created_pnrs.append(res["pnr"])
                    self.stats["successful_holds"] += 1
                except Exception as e:
                    pass

            elif action_type == "PAY" and self.created_pnrs:
                pnr = random.choice(self.created_pnrs)
                simulate_success = random.random() > 0.10  # 90% payment success rate
                try:
                    res = ReservationService.confirm_payment(self.db, pnr, simulate_success=simulate_success)
                    if simulate_success:
                        self.confirmed_pnrs.append(pnr)
                        self.stats["successful_confirmations"] += 1
                except ValueError:
                    self.stats["failed_payments"] += 1

            elif action_type == "CANCEL" and self.confirmed_pnrs:
                pnr = random.choice(self.confirmed_pnrs)
                try:
                    res = ReservationService.cancel_reservation(self.db, pnr)
                    self.stats["cancellations"] += 1
                    promotions = len(res.get("promotions_triggered", []))
                    self.stats["promotions_triggered"] += promotions
                    if res.get("booking_status") == "CANCELLED":
                        self.confirmed_pnrs.remove(pnr)
                except Exception:
                    pass

            elif action_type == "LOOKUP_PNR":
                # Test both valid PNRs and synthetic absent PNRs
                if random.random() < 0.6 and self.created_pnrs:
                    query_pnr = random.choice(self.created_pnrs)
                else:
                    query_pnr = f"ABSENT_{random.randint(100000, 999999)}"

                t_lookup_start = time.perf_counter()
                in_bloom = dsa_manager.bloom_filter.contains(query_pnr)
                if in_bloom:
                    self.stats["bloom_hits"] += 1
                    # Search hash table
                    entry = dsa_manager.pnr_table.search(query_pnr)
                else:
                    self.stats["bloom_rejections"] += 1

                t_lookup_end = time.perf_counter()
                self.stats["hash_table_lookups_time_ms"] += (t_lookup_end - t_lookup_start) * 1000.0
                self.stats["pnr_lookups"] += 1

            elif action_type == "SORT_CHART":
                # Academic verification of in-place chart sorting under dynamic load
                train_run_id = random.choice(run_ids)
                from app.models.entities import Berth, Coach
                berths = (
                    self.db.query(Berth)
                    .join(Coach, Berth.coach_id == Coach.id)
                    .filter(Coach.train_run_id == train_run_id)
                    .all()
                )
                raw_records = [{
                    "coach_code": b.coach.coach_code,
                    "berth_number": b.berth_number,
                    "status": b.current_status
                } for b in berths]

                t_sort_start = time.perf_counter()
                sorted_records = merge_sort_chart(raw_records)
                t_sort_end = time.perf_counter()

                self.stats["sorting_time_ms"] += (t_sort_end - t_sort_start) * 1000.0
                self.stats["sorting_events"] += 1

            self.stats["total_events"] += 1

        self.stats["end_time"] = time.perf_counter()
        self.stats["total_duration_sec"] = round(self.stats["end_time"] - self.stats["start_time"], 4)
        self.stats["events_per_second"] = round(self.stats["total_events"] / self.stats["total_duration_sec"], 2)

        # Collect final DSA structural metrics
        self.stats["dsa_metrics"] = {
            "pnr_hash_table": dsa_manager.pnr_table.get_metrics(),
            "bloom_filter": dsa_manager.bloom_filter.get_metrics()
        }

        self.db.close()
        return self.stats

if __name__ == "__main__":
    runner = SimulationRunner(target_events=1200)
    results = runner.run()
    import pprint
    print("\n========== SIMULATION EXECUTION SUMMARY ==========")
    pprint.pprint(results)

