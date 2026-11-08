from typing import Any, Optional, List, Tuple

class HashNode:
    """Linked list node used for separate chaining collision resolution."""
    def __init__(self, key: str, value: Any):
        self.key: str = key
        self.value: Any = value
        self.next: Optional['HashNode'] = None


class PNRHashTable:
    """
    Custom Hash Table for PNR indexing using Separate Chaining.
    
    Academic Complexity Analysis:
    - Average Time Complexity:
        * Insert: O(1)
        * Search: O(1)
        * Delete: O(1)
    - Worst-case Time Complexity:
        * O(N) when all keys hash to the same bucket (minimized by polynomial rolling hash).
    - Space Complexity: O(M + N) where M is bucket capacity and N is element count.
    - Load Factor: alpha = N / M. Resizes (doubles capacity) when alpha >= 0.75.
    """

    def __init__(self, initial_capacity: int = 64, max_load_factor: float = 0.75):
        if initial_capacity < 4:
            initial_capacity = 4
        self.capacity: int = initial_capacity
        self.max_load_factor: float = max_load_factor
        self.size: int = 0
        self.buckets: List[Optional[HashNode]] = [None] * self.capacity
        
        # Statistics for academic evaluation & complexity inspection
        self.total_collisions: int = 0
        self.resizes: int = 0

    def _hash(self, key: str) -> int:
        """
        Polynomial rolling hash function:
        hash(S) = ( sum_{i=0}^{n-1} S[i] * p^i ) % capacity
        with p = 31 (a standard prime base for alphanumeric strings like 10-char PNRs).
        """
        p = 31
        hash_val = 0
        p_pow = 1
        for char in key:
            hash_val = (hash_val + ord(char) * p_pow) % self.capacity
            p_pow = (p_pow * p) % 1000000007  # intermediate modulo to avoid integer explosion
        return hash_val % self.capacity

    @property
    def load_factor(self) -> float:
        return self.size / self.capacity

    def _resize(self, new_capacity: int) -> None:
        """Doubles capacity and rehashes all active nodes."""
        old_buckets = self.buckets
        self.capacity = new_capacity
        self.buckets = [None] * self.capacity
        self.size = 0
        self.resizes += 1

        for head in old_buckets:
            curr = head
            while curr:
                self.insert(curr.key, curr.value, resize_check=False)
                curr = curr.next

    def insert(self, key: str, value: Any, resize_check: bool = True) -> bool:
        """
        Inserts or updates a key-value pair.
        Returns True if inserted, False if updated existing key.
        """
        if resize_check and self.load_factor >= self.max_load_factor:
            self._resize(self.capacity * 2)

        idx = self._hash(key)
        head = self.buckets[idx]

        if head is None:
            self.buckets[idx] = HashNode(key, value)
            self.size += 1
            return True

        # Collision occurred or updating existing key
        curr = head
        prev = None
        collision_detected = False

        while curr:
            if curr.key == key:
                curr.value = value  # Update existing
                return False
            prev = curr
            curr = curr.next
            collision_detected = True

        if collision_detected:
            self.total_collisions += 1

        # Append to chain at end
        prev.next = HashNode(key, value)
        self.size += 1
        return True

    def search(self, key: str) -> Optional[Any]:
        """Looks up a value by PNR. Returns None if not found."""
        idx = self._hash(key)
        curr = self.buckets[idx]
        while curr:
            if curr.key == key:
                return curr.value
            curr = curr.next
        return None

    def delete(self, key: str) -> bool:
        """Deletes a key-value pair. Returns True if deleted, False if not found."""
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
        """Returns statistics for academic reporting and complexity demonstration."""
        bucket_lengths = []
        occupied_buckets = 0
        for head in self.buckets:
            length = 0
            curr = head
            while curr:
                length += 1
                curr = curr.next
            bucket_lengths.append(length)
            if length > 0:
                occupied_buckets += 1

        max_chain = max(bucket_lengths) if bucket_lengths else 0
        return {
            "size": self.size,
            "capacity": self.capacity,
            "load_factor": round(self.load_factor, 4),
            "occupied_buckets": occupied_buckets,
            "max_chain_length": max_chain,
            "total_collisions": self.total_collisions,
            "resizes": self.resizes
        }

