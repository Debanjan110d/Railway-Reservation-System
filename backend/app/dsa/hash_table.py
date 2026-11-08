from typing import Any, Optional, List

class HashNode:
    def __init__(self, key: str, value: Any):
        self.key = key
        self.value = value
        self.next: Optional['HashNode'] = None


class PNRHashTable:
    """Separate-chaining hash table for fast PNR lookup without DB queries."""

    def __init__(self, initial_capacity: int = 64, max_load_factor: float = 0.75):
        self.capacity = max(initial_capacity, 4)
        self.max_load_factor = max_load_factor
        self.size = 0
        self.buckets: List[Optional[HashNode]] = [None] * self.capacity
        
        # stats tracked for performance checks
        self.total_collisions = 0
        self.resizes = 0

    def _hash(self, key: str) -> int:
        # standard polynomial rolling hash, prime base 31 works well for alphanumeric PNR
        p = 31
        hash_val = 0
        p_pow = 1
        for ch in key:
            hash_val = (hash_val + ord(ch) * p_pow) % self.capacity
            p_pow = (p_pow * p) % 1000000007
        return hash_val % self.capacity

    @property
    def load_factor(self) -> float:
        return self.size / self.capacity

    def _resize(self, new_cap: int) -> None:
        old_buckets = self.buckets
        self.capacity = new_cap
        self.buckets = [None] * self.capacity
        self.size = 0
        self.resizes += 1

        for head in old_buckets:
            curr = head
            while curr:
                self.insert(curr.key, curr.value, resize_check=False)
                curr = curr.next

    def insert(self, key: str, value: Any, resize_check: bool = True) -> bool:
        if resize_check and self.load_factor >= self.max_load_factor:
            self._resize(self.capacity * 2)

        idx = self._hash(key)
        head = self.buckets[idx]

        if not head:
            self.buckets[idx] = HashNode(key, value)
            self.size += 1
            return True

        curr = head
        prev = None
        has_collision = False

        while curr:
            if curr.key == key:
                curr.value = value
                return False
            prev = curr
            curr = curr.next
            has_collision = True

        if has_collision:
            self.total_collisions += 1

        prev.next = HashNode(key, value)
        self.size += 1
        return True

    def search(self, key: str) -> Optional[Any]:
        idx = self._hash(key)
        curr = self.buckets[idx]
        while curr:
            if curr.key == key:
                return curr.value
            curr = curr.next
        return None

    def delete(self, key: str) -> bool:
        idx = self._hash(key)
        curr = self.buckets[idx]
        prev = None

        while curr:
            if curr.key == key:
                if prev is None:
                    self.buckets[idx] = curr.next
                else:
                    prev.next = curr.next
                self.size -= 1
                return True
            prev = curr
            curr = curr.next

        return False

    def contains(self, key: str) -> bool:
        return self.search(key) is not None

    def get_metrics(self) -> dict:
        bucket_lengths = []
        occupied_count = 0
        for head in self.buckets:
            length = 0
            curr = head
            while curr:
                length += 1
                curr = curr.next
            bucket_lengths.append(length)
            if length > 0:
                occupied_count += 1

        max_chain = max(bucket_lengths) if bucket_lengths else 0
        return {
            "size": self.size,
            "capacity": self.capacity,
            "load_factor": round(self.load_factor, 4),
            "occupied_buckets": occupied_count,
            "max_chain_length": max_chain,
            "total_collisions": self.total_collisions,
            "resizes": self.resizes
        }
