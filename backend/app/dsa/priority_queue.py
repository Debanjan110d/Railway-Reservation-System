from typing import Any, List, Optional, Tuple
import datetime

class PriorityQueueEntry:
    """
    Container for passenger in the Priority Queue.
    
    Priority Policy Tuple:
    (quota_rank, category_subweight, booking_timestamp, passenger_id)
    Lower comparison value means HIGHER priority for allocation.
    
    Quota Ranks:
    0: SS / Senior Citizen
    1: LD / Ladies
    2: GN / General
    3: TQ / Tatkal (Typically Tatkal waitlist has distinct promotion logic)
    """
    QUOTA_RANKS = {
        "SS": 0,  # Senior Citizen / Lower Berth
        "LD": 1,  # Ladies
        "GN": 2,  # General
        "TQ": 3   # Tatkal
    }

    def __init__(self, passenger_id: int, pnr: str, quota: str, age: int, timestamp: datetime.datetime, extra_data: Any = None):
        self.passenger_id: int = passenger_id
        self.pnr: str = pnr
        self.quota: str = quota.upper()
        self.age: int = age
        self.timestamp: datetime.datetime = timestamp
        self.extra_data: Any = extra_data
        
        # Calculate comparison priority key
        # We invert age so older passengers in same quota get priority
        quota_rank = self.QUOTA_RANKS.get(self.quota, 2)
        age_weight = -self.age if self.quota == "SS" else 0
        self.priority_key = (quota_rank, age_weight, self.timestamp.timestamp(), self.passenger_id)

    def __lt__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key < other.priority_key

    def __le__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key <= other.priority_key

    def __gt__(self, other: 'PriorityQueueEntry') -> bool:
        return self.priority_key > other.priority_key


class PriorityQueue:
    """
    Custom Binary Min-Heap Implementation for Waiting-List Prioritization.
    
    Academic Complexity:
    - Push: O(log N)
    - Pop (extract min/highest priority): O(log N)
    - Peek: O(1)
    - Remove by passenger_id (cancellation): O(N) search + O(log N) heapify-down
    """

    def __init__(self):
        self.heap: List[PriorityQueueEntry] = []

    def __len__(self) -> int:
        return len(self.heap)

    def is_empty(self) -> bool:
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
        l = self._left_child(i)
        r = self._right_child(i)

        if l < n and self.heap[l] < self.heap[min_idx]:
            min_idx = l
        if r < n and self.heap[r] < self.heap[min_idx]:
            min_idx = r

        if min_idx != i:
            self.heap[i], self.heap[min_idx] = self.heap[min_idx], self.heap[i]
            self._sift_down(min_idx)

    def push(self, entry: PriorityQueueEntry) -> None:
        self.heap.append(entry)
        self._sift_up(len(self.heap) - 1)

    def pop(self) -> Optional[PriorityQueueEntry]:
        if not self.heap:
            return None
        root = self.heap[0]
        last = self.heap.pop()
        if self.heap:
            self.heap[0] = last
            self._sift_down(0)
        return root

    def peek(self) -> Optional[PriorityQueueEntry]:
        if not self.heap:
            return None
        return self.heap[0]

    def remove_by_passenger_id(self, passenger_id: int) -> Optional[PriorityQueueEntry]:
        """Supports waitlist cancellation by removing a specific passenger."""
        target_idx = -1
        for idx, entry in enumerate(self.heap):
            if entry.passenger_id == passenger_id:
                target_idx = idx
                break

        if target_idx == -1:
            return None

        removed = self.heap[target_idx]
        last = self.heap.pop()
        if target_idx < len(self.heap):
            self.heap[target_idx] = last
            self._sift_down(target_idx)
            self._sift_up(target_idx)
        return removed

    def to_list(self) -> List[PriorityQueueEntry]:
        """Returns sorted snapshot of elements without modifying original heap."""
        temp_heap = list(self.heap)
        sorted_elements = []
        pq_copy = PriorityQueue()
        pq_copy.heap = temp_heap
        while not pq_copy.is_empty():
            sorted_elements.append(pq_copy.pop())
        return sorted_elements

