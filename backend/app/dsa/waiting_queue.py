import threading
from typing import Any, Optional, List

class QueueNode:
    def __init__(self, value: Any):
        self.value: Any = value
        self.prev: Optional['QueueNode'] = None
        self.next: Optional['QueueNode'] = None


class WaitingQueue:
    """
    Doubly Linked List FIFO Queue for RAC and strict sequence waiting lists.
    
    Academic Complexity:
    - Enqueue: O(1)
    - Dequeue: O(1)
    - Peek: O(1)
    - Remove Node (when node pointer is known): O(1)
    """

    def __init__(self):
        self.head: Optional[QueueNode] = None
        self.tail: Optional[QueueNode] = None
        self._size: int = 0
        self._lock = threading.RLock()

    def __len__(self) -> int:
        with self._lock:
            return self._size

    def is_empty(self) -> bool:
        with self._lock:
            return self._size == 0

    def enqueue(self, value: Any) -> QueueNode:
        with self._lock:
            node = QueueNode(value)
            if self.tail is None:
                self.head = self.tail = node
            else:
                self.tail.next = node
                node.prev = self.tail
                self.tail = node
            self._size += 1
            return node

    def dequeue(self) -> Optional[Any]:
        with self._lock:
            if self.head is None:
                return None
            node = self.head
            self.head = self.head.next
            if self.head is None:
                self.tail = None
            else:
                self.head.prev = None
            self._size -= 1
            return node.value

    def peek(self) -> Optional[Any]:
        with self._lock:
            if self.head is None:
                return None
            return self.head.value

    def remove_by_predicate(self, predicate) -> Optional[Any]:
        """Finds and extracts first element matching predicate in O(N)."""
        with self._lock:
            curr = self.head
            while curr:
                if predicate(curr.value):
                    # Unlink curr
                    if curr.prev:
                        curr.prev.next = curr.next
                    else:
                        self.head = curr.next

                    if curr.next:
                        curr.next.prev = curr.prev
                    else:
                        self.tail = curr.prev

                    self._size -= 1
                    return curr.value
                curr = curr.next
            return None

    def to_list(self) -> List[Any]:
        with self._lock:
            res = []
            curr = self.head
            while curr:
                res.append(curr.value)
                curr = curr.next
            return res

