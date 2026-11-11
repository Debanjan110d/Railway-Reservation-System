import math
import threading
from typing import List

class BloomFilter:
    """Probabilistic filter for quick PNR existence check before DB/hash lookup."""

    def __init__(self, expected_elements: int = 10000, false_positive_rate: float = 0.01):
        self.n = expected_elements
        self.p = false_positive_rate
        self._lock = threading.RLock()

        # bit array sizing formula: m = - (n * ln(p)) / (ln(2)^2)
        calc_m = int(- (self.n * math.log(self.p)) / (math.log(2) ** 2))
        self.m = max(calc_m, 64)

        # optimal k = (m / n) * ln(2)
        self.k = max(1, int((self.m / self.n) * math.log(2)))

        self.bit_array: List[bool] = [False] * self.m
        self.count = 0

    def _hashes(self, item: str) -> List[int]:
        normalized = str(item).strip().upper()
        # Kirsch-Mitzenmacher optimization: generate k hashes from 2 hash values
        # hash 1: FNV-1a 32-bit
        fnv_prime = 16777619
        h1 = 2166136261
        for ch in normalized:
            h1 = ((h1 ^ ord(ch)) * fnv_prime) & 0xFFFFFFFF

        # hash 2: polynomial hash with prime base 53
        h2 = 0
        p_pow = 1
        for ch in normalized:
            h2 = (h2 + ord(ch) * p_pow) & 0xFFFFFFFF
            p_pow = (p_pow * 53) & 0xFFFFFFFF
        if h2 == 0:
            h2 = 1

        indices = []
        for i in range(self.k):
            idx = (h1 + i * h2) % self.m
            indices.append(idx)
        return indices

    def add(self, item: str) -> None:
        with self._lock:
            for idx in self._hashes(item):
                self.bit_array[idx] = True
            self.count += 1

    def contains(self, item: str) -> bool:
        with self._lock:
            for idx in self._hashes(item):
                if not self.bit_array[idx]:
                    return False
            return True

    @property
    def theoretical_fp_rate(self) -> float:
        with self._lock:
            if self.count == 0:
                return 0.0
            exponent = - (self.k * self.count) / float(self.m)
            return (1.0 - math.exp(exponent)) ** self.k

    def get_metrics(self) -> dict:
        with self._lock:
            bits_set = sum(1 for b in self.bit_array if b)
            return {
                "bit_array_size_m": self.m,
                "hash_functions_k": self.k,
                "items_inserted_n": self.count,
                "bits_set": bits_set,
                "bit_saturation_ratio": round(bits_set / self.m, 4),
                "theoretical_fp_rate": round(self.theoretical_fp_rate, 6)
            }
