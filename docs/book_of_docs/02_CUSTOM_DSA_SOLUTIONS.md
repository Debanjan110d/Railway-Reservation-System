# Chapter 2: Custom DSA Formulations & Mathematical Solutions

---

## 1. Overview of Custom Academic DSA Architecture

To eliminate reliance on database indexing and built-in black-box collection libraries, the reservation engine implements five custom Data Structures and Algorithms from mathematical first principles.

```
+---------------------------------------------------------------------------------------+
|                                CUSTOM DSA IN-MEMORY SUITE                             |
+---------------------------+---------------------------+-------------------------------+
| Data Structure            | Core File Location        | Primary Operational Purpose   |
+---------------------------+---------------------------+-------------------------------+
| Separate-Chaining Hash    | backend/app/dsa/hash_table.py  | O(1) Instant PNR Retrieval     |
| Multi-Criteria Min-Heap   | backend/app/dsa/priority_queue.py | O(log N) Waiting-List Quota   |
| Doubly-Linked Circular Q  | backend/app/dsa/waiting_queue.py  | O(1) RAC In-Order Queue       |
| Probabilistic Bloom Filter| backend/app/dsa/bloom_filter.py  | O(k) Non-Existent PNR Rejection|
| Stable Merge Sorter       | backend/app/dsa/sorting.py       | O(N log N) Master Chart Sort  |
+---------------------------+---------------------------+-------------------------------+
```

---

## 2. Separate-Chaining PNR Hash Table

### Mathematical Formulation
A hash function must map an arbitrary 10-digit alphanumeric PNR string $S = s_0 s_1 \dots s_{L-1}$ into a uniform integer index within an array of capacity $M$.

We formulate a **Polynomial Rolling Hash Function** with a prime base $p = 31$:

$$H(S) = \left( \sum_{i=0}^{L-1} \text{ord}(s_i) \cdot p^i \right) \pmod M$$

To avoid arithmetic integer overflow while maintaining numerical precision, modulo arithmetic is computed iteratively:

$$h_0 = \text{ord}(s_0) \pmod M$$
$$h_i = (h_{i-1} + \text{ord}(s_i) \cdot p^i) \pmod M$$

### Collision Resolution: Separate Chaining with Dynamic Resizing
- Each bucket in array $T[0 \dots M-1]$ stores a pointer to the head of a singly linked list of `HashNode` objects.
- **Load Factor Definition:** $\alpha = \frac{N}{M}$, where $N$ is total inserted PNR keys and $M$ is current bucket capacity.
- **Dynamic Growth Invariant:** When $\alpha \ge 0.75$, the hash table allocates an expanded array of size $2M$, rehashes all existing nodes, and updates capacity:

```
Bucket [0] -> None
Bucket [1] -> [PNR: 0342926924 | Alice | CNF] -> None
Bucket [2] -> [PNR: 1294810293 | Bob   | RAC] -> [PNR: 9812039481 | Dave | WL] -> None
...
Bucket [M-1] -> None
```

### Asymptotic Complexity Analysis
| Operation | Average Case | Worst Case (Degenerate) | Space Complexity |
| :--- | :--- | :--- | :--- |
| **Insert** | $O(1)$ | $O(N)$ (all keys collide) | $O(1)$ auxiliary |
| **Search** | $O(1)$ | $O(N)$ | $O(1)$ auxiliary |
| **Delete** | $O(1)$ | $O(N)$ | $O(1)$ auxiliary |
| **Rehash ($2M$)** | $O(N)$ | $O(N)$ | $O(N)$ temporary |

---

## 3. Multi-Criteria Min-Heap Priority Queue

### Priority Ranking Policy
Railway reservation waiting lists require strict regulatory fairness. We define a lexicographic **4-Tuple Priority Key**:

$$K = (W_{\text{quota}},\, A_{\text{bonus}},\, T_{\text{timestamp}},\, ID_{\text{passenger}})$$

1. **Quota Rank ($W_{\text{quota}}$):**
   - Senior Citizen (`SS`): $W = 0$ (Highest Priority)
   - Ladies Quota (`LD`): $W = 1$
   - General Quota (`GN`): $W = 2$
   - Tatkal Quota (`TQ`): $W = 3$ (Lowest Waiting List Priority)
2. **Age Bonus ($A_{\text{bonus}}$):**
   - For `SS` quota: $A_{\text{bonus}} = -\text{Age}$. A 75-year-old senior has priority key $(-75) < (-62)$, ensuring older seniors receive lower berth allocations first.
   - For non-`SS` quotas: $A_{\text{bonus}} = 0$.
3. **Booking Timestamp ($T_{\text{timestamp}}$):**
   - Unix epoch float preserving microsecond booking order.
4. **Passenger ID ($ID_{\text{passenger}}$):**
   - Strict tie-breaker guaranteeing total ordering across simultaneous submissions.

### Binary Min-Heap Invariant
In an array representation where the root is at index $0$:
- $\text{Parent}(i) = \lfloor \frac{i-1}{2} \rfloor$
- $\text{LeftChild}(i) = 2i + 1$
- $\text{RightChild}(i) = 2i + 2$
- **Invariant:** For every node $i > 0$, $\text{Heap}[\text{Parent}(i)] \le \text{Heap}[i]$.

### Restoration Algorithms (`_sift_up` and `_sift_down`)
- **`push(entry)`:** Appends entry to the end of the array ($O(1)$) and executes `_sift_up` swapping with parents until heap invariant holds ($O(\log N)$).
- **`pop()`:** Replaces root element with the tail element ($O(1)$) and executes `_sift_down` recursively swapping with the smaller of its children ($O(\log N)$).

```
          [SS, Age 75, 10:00:00] (Root / Highest Priority)
                 /                  \
   [SS, Age 62, 10:01:00]      [LD, Age 30, 10:00:15]
         /
   [GN, Age 28, 10:00:02]
```

---

## 4. Doubly-Linked Circular FIFO Waiting Queue

For Reservation Against Cancellation (RAC) passengers, allocation is strictly sequential:

- **Enqueue:** Appends node to tail in $O(1)$ time.
- **Dequeue:** Extracts node from head in $O(1)$ time.
- **Cancellation Unlink:** When passenger $P_i$ cancels from within the queue, node pointers are updated directly:
  $$\text{node.prev.next} \leftarrow \text{node.next}$$
  $$\text{node.next.prev} \leftarrow \text{node.prev}$$
  This extraction operates in $O(1)$ time given the node reference, eliminating array shift penalties ($O(N)$).

---

## 5. Probabilistic Bloom Filter Pre-Checker

### Theoretical Foundation
A Bloom Filter is a space-efficient probabilistic data structure that tests whether an element is a member of a set.
- **Guarantee:** **Zero False Negatives**. If the Bloom Filter returns `False`, the PNR is definitively absent.
- **Possibility:** Small bounded **False Positive Rate** ($p$), where a non-existent PNR returns `True` and is subsequently verified by the Hash Table.

### Optimal Bit Array Sizing Formula
Given expected inserted elements $n$ and target false-positive probability $p = 0.01$ ($1\%$):

$$m = -\frac{n \cdot \ln(p)}{(\ln 2)^2}$$

For $n = 10{,}000$ and $p = 0.01$:

$$m = -\frac{10000 \cdot (-4.60517)}{0.48045} \approx 95{,}850 \text{ bits } (\approx 11.7 \text{ KB})$$

### Optimal Number of Hash Functions ($k$)

$$k = \frac{m}{n} \cdot \ln(2) = \frac{95850}{10000} \cdot 0.69315 \approx 6.64 \implies k = 6$$

### Kirsch-Mitzenmacher Double-Hashing Optimization
Standard Bloom filters require $k$ independent hash computations, which is computationally expensive. We employ the **Kirsch-Mitzenmacher Theorem**, which proves that $k$ hash values can be simulated using only two primary hash functions without asymptotic loss of false-positive guarantees:

$$g_i(x) = (h_1(x) + i \cdot h_2(x)) \pmod m \quad \text{for } i \in [0, k-1]$$

Where:
- $h_1(x)$ is computed via **FNV-1a 32-bit Hash**:
  $$h_1 = ((h_1 \oplus \text{ord}(ch)) \cdot \text{FNV\_PRIME}) \pmod{2^{32}}$$
- $h_2(x)$ is computed via **Polynomial Prime Base 53 Hash**.

---

## 6. In-Place Stable Merge Sorter

### Why Stability is Mandatory
Official railway reservation charts require sorting by `(Coach Code ASC, Berth Number ASC)`. When multiple passenger records have matching primary attributes or split seat allocations, an unstable sort (like QuickSort or HeapSort) can invert their relative insertion order, causing passenger confusion.

Merge Sort guarantees:
1. **Algorithmic Stability:** Equal elements preserve their relative input sequence.
2. **Deterministic Time Bound:** Worst-case, average-case, and best-case performance is uniformly $\Theta(N \log N)$. Zero vulnerability to worst-case $O(N^2)$ degradation seen in QuickSort with poor pivot choices.

### Divide-and-Conquer Recurrence
Let $T(N)$ be the time required to sort $N$ berths:

$$T(N) = 2 \cdot T\left(\frac{N}{2}\right) + \Theta(N)$$

By the **Master Theorem** ($a = 2, b = 2, d = 1 \implies \log_b a = d$):

$$T(N) = \Theta(N \log N)$$

