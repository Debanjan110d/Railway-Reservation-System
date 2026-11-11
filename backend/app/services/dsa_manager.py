import threading
from app.dsa.hash_table import PNRHashTable
from app.dsa.bloom_filter import BloomFilter
from app.dsa.priority_queue import PriorityQueue
from app.dsa.waiting_queue import WaitingQueue

class DSAManager:
    """
    Central in-memory coordinator of all required Academic Data Structures.
    Keeps PNR Hash Table, Bloom Filter, Priority Queue, and Waiting List in sync with DB transactions.
    Thread-safe for concurrent parallel execution across API worker threads.
    """
    _instance = None
    _init_lock = threading.Lock()

    def __new__(cls):
        with cls._init_lock:
            if cls._instance is None:
                cls._instance = super(DSAManager, cls).__new__(cls)
                cls._instance._lock = threading.RLock()
                cls._instance.pnr_table = PNRHashTable(initial_capacity=128)
                cls._instance.bloom_filter = BloomFilter(expected_elements=10000, false_positive_rate=0.01)
                # Map train_run_id -> PriorityQueue for waiting list
                cls._instance.train_waiting_heaps = {}
                # Map train_run_id -> WaitingQueue for RAC
                cls._instance.train_rac_queues = {}
        return cls._instance

    def get_priority_queue(self, train_run_id: int) -> PriorityQueue:
        with self._lock:
            if train_run_id not in self.train_waiting_heaps:
                self.train_waiting_heaps[train_run_id] = PriorityQueue()
            return self.train_waiting_heaps[train_run_id]

    def get_rac_queue(self, train_run_id: int) -> WaitingQueue:
        with self._lock:
            if train_run_id not in self.train_rac_queues:
                self.train_rac_queues[train_run_id] = WaitingQueue()
            return self.train_rac_queues[train_run_id]

    def reset(self):
        with self._lock:
            self.pnr_table = PNRHashTable(initial_capacity=128)
            self.bloom_filter = BloomFilter(expected_elements=10000, false_positive_rate=0.01)
            self.train_waiting_heaps = {}
            self.train_rac_queues = {}

dsa_manager = DSAManager()

