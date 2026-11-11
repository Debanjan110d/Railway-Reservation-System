import threading
from typing import Any, List, Optional
import datetime

class PriorityQueueEntry:
    # Quota ranking: SS (Senior) > LD (Ladies) > GN (General) > TQ (Tatkal)
    QUOTA_RANKS = {
        "SS": 0,
        "LD": 1,
        "GN": 2,
        "TQ": 3
    }

    def __init__(self, passenger_id: int, pnr: str, quota: str, age: int, timestamp: datetime.datetime, extra_data: Any = None):
        self.passenger_id = passenger_id
        self.pnr = pnr
        self.quota = quota.upper()
        self.age = age
        self.timestamp = timestamp
        self.extra_data = extra_data
        
        # tie breaker tuple: (quota, age_priority, booking_time, passenger_id)
        # Note: -age gives priority to older passengers within senior quota
        quota_weight = self.QUOTA_RANKS.get(self.quota, 2)
        age_bonus = -self.age if self.quota == "SS" else 0
        self.priority_key = (quota_weight, age_bonus, self.timestamp.timestamp(), self.passenger_id)

    def __lt__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key < other.priority_key

    def __le__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key <= other.priority_key

    def __gt__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key > other.priority_key


class PriorityQueue:
    """Min-heap implementation for waiting list auto-promotions."""

    def __init__(self):
        self.heap: List[PriorityQueueEntry] = []
        self._lock = threading.RLock()

    def __len__(self) -> int:
        with self._lock:
            return len(self.heap)

    def is_empty(self) -> bool:
        with self._lock:
            return len(self.heap) == 0

    def _parent(self, i: int) -> int:
        return (i - 1) // 2

    def _left_child(self, i: int) -> int:
        return 2 * i + 1

    def _right_child(self, i: int) -> int:
        return 2 * i + 2

    def _sift_up(self, i: int) -> None:
        while i > 0 and self.heap[i] < self.heap[self._parent(i)]:
            p = self._parent(i)
            self.heap[i], self.heap[p] = self.heap[p], self.heap[i]
            i = p

    def _sift_down(self, i: int) -> None:
        min_idx = i
        n = len(self.heap)
        left = self._left_child(i)
        right = self._right_child(i)

        if left < n and self.heap[left] < self.heap[min_idx]:
            min_idx = left
        if right < n and self.heap[right] < self.heap[min_idx]:
            min_idx = right

        if min_idx != i:
            self.heap[i], self.heap[min_idx] = self.heap[min_idx], self.heap[i]
            self._sift_down(min_idx)

    def push(self, entry: PriorityQueueEntry) -> None:
        with self._lock:
            self.heap.append(entry)
            self._sift_up(len(self.heap) - 1)

    def pop(self) -> Optional[PriorityQueueEntry]:
        with self._lock:
            if not self.heap:
                return None
            top = self.heap[0]
            tail = self.heap.pop()
            if self.heap:
                self.heap[0] = tail
                self._sift_down(0)
            return top

    def peek(self) -> Optional[PriorityQueueEntry]:
        with self._lock:
            return self.heap[0] if self.heap else None

    def remove_by_passenger_id(self, passenger_id: int) -> Optional[PriorityQueueEntry]:
        with self._lock:
            # cancellation from waiting list
            idx = -1
            for i, item in enumerate(self.heap):
                if item.passenger_id == passenger_id:
                    idx = i
                    break

            if idx == -1:
                return None

            removed = self.heap[idx]
            tail = self.heap.pop()
            if idx < len(self.heap):
                self.heap[idx] = tail
                self._sift_down(idx)
                self._sift_up(idx)
            return removed

    def to_list(self) -> List[PriorityQueueEntry]:
        with self._lock:
            # snapshot sorted without draining actual heap
            copy = PriorityQueue()
            copy.heap = list(self.heap)
            res = []
            while not copy.is_empty():
                res.append(copy.pop())
            return res
