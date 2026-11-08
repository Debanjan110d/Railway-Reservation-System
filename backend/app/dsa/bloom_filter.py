import math
from typing import List

class BloomFilter:
    """
    Probabilistic Data Structure for PNR pre-checking.
    
    Academic Complexity & Properties:
    - Insertion: O(k)
    - Query: O(k)
    - Space: O(m) bits
    - False Positive Probability: p ≈ (1 - e^(-kn/m))^k
    - Guarantee: Zero False Negatives (If bloom filter says 'not present', it is definitely not present).
    - Inability for arbitrary deletion: Standard bit array cannot distinguish which element set a bit.
    """

    def __init__(self, expected_elements: int = 10000, false_positive_rate: float = 0.01):
        self.n: int = expected_elements
        self.p: float = false_positive_rate

        # Optimal bit array size m = - (n * ln(p)) / (ln(2)^2)
        self.m: int = int(- (self.n * math.log(self.p)) / (math.log(2) ** 2))
        if self.m < 64:
            self.m = 64

        # Optimal number of hash functions k = (m / n) * ln(2)
        self.k: int = max(1, int((self.m / self.n) * math.log(2)))

        # Bit array represented using integer words or boolean list
        # Boolean list gives pure python portability without external C modules
        self.bit_array: List[bool] = [False] * self.m
        self.count: int = 0

    def _hashes(self, item: str) -> List[int]:
        """
        Double Hashing technique (Kirsch-Mitzenmacher):
        hash_i(x) = (hash1(x) + i * hash2(x)) % m
        Simulates k independent hash functions using FNV-1a and standard polynomial hash.
        """
        # Hash 1: FNV-1a 32-bit
        fnv_prime = 16777619
        hash1 = 2166136261
        for char in item:
            hash1 = ((hash1 ^ ord(char)) * fnv_prime) & 0xFFFFFFFF

        # Hash 2: Rolling hash with base 53
        hash2 = 0
        p_pow = 1
        for char in item:
            hash2 = (hash2 + ord(char) * p_pow) & 0xFFFFFFFF
            p_pow = (p_pow * 53) & 0xFFFFFFFF
        if hash2 == 0:
            hash2 = 1

        # Generate k indices
        indices = []
        for i in range(self.k):
            idx = (hash1 + i * hash2) % self.m
            indices.append(idx)
        return indices

    def add(self, item: str) -> None:
        """Adds a PNR key to the bloom filter."""
        for idx in self._hashes(item):
            self.bit_array[idx] = True
        self.count += 1

    def contains(self, item: str) -> bool:
        """
        Queries membership.
        Returns:
            False: DEFINITELY ABSENT.
            True: POSSIBLY PRESENT (subject to false positive probability p).
        """
        for idx in self._hashes(item):
            if not self.bit_array[idx]:
                return False
        return True

    @property
    def theoretical_fp_rate(self) -> float:
        """Calculates current theoretical false positive probability."""
        if self.count == 0:
            return 0.0
        exponent = - (self.k * self.count) / float(self.m)
        return (1.0 - math.exp(exponent)) ** self.k

    def get_metrics(self) -> dict:
        bits_set = sum(1 for b in self.bit_array if b)
        return {
            "bit_array_size_m": self.m,
            "hash_functions_k": self.k,
            "items_inserted_n": self.count,
            "bits_set": bits_set,
            "bit_saturation_ratio": round(bits_set / self.m, 4),
            "theoretical_fp_rate": round(self.theoretical_fp_rate, 6)
        }

