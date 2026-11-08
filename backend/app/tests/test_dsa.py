import datetime
from app.dsa.hash_table import PNRHashTable
from app.dsa.bloom_filter import BloomFilter
from app.dsa.priority_queue import PriorityQueue, PriorityQueueEntry
from app.dsa.waiting_queue import WaitingQueue
from app.dsa.sorting import merge_sort_chart

def test_pnr_hash_table_operations():
    ht = PNRHashTable(initial_capacity=8, max_load_factor=0.75)
    
    # Test insertion
    assert ht.insert("PNR100001", {"name": "Alice", "status": "CNF"}) is True
    assert ht.insert("PNR100002", {"name": "Bob", "status": "RAC"}) is True
    assert ht.insert("PNR100003", {"name": "Charlie", "status": "WL"}) is True
    
    # Test search
    res = ht.search("PNR100001")
    assert res is not None
    assert res["name"] == "Alice"
    assert ht.search("NONEXISTENT") is None
    
    # Test update
    assert ht.insert("PNR100001", {"name": "Alice Cooper", "status": "CNF"}) is False
    assert ht.search("PNR100001")["name"] == "Alice Cooper"
    
    # Test load factor and dynamic resizing
    initial_cap = ht.capacity
    for i in range(10, 30):
        ht.insert(f"PNR{i}", {"name": f"User {i}"})
    assert ht.capacity > initial_cap
    assert ht.resizes >= 1
    
    # Test delete
    assert ht.delete("PNR100002") is True
    assert ht.search("PNR100002") is None
    assert ht.delete("PNR100002") is False


def test_bloom_filter_guarantees():
    bf = BloomFilter(expected_elements=100, false_positive_rate=0.01)
    
    # Insert keys
    test_keys = [f"PNR_{i:04d}" for i in range(50)]
    for key in test_keys:
        bf.add(key)
        
    # Guarantee: Zero false negatives
    for key in test_keys:
        assert bf.contains(key) is True
        
    # Test negative lookups (some might be false positive, but vast majority should be false)
    absent_keys = [f"ABSENT_{i:04d}" for i in range(50)]
    negatives = sum(1 for k in absent_keys if not bf.contains(k))
    assert negatives >= 45  # with 1% FP rate, nearly all should be definitely negative


def test_priority_queue_ordering():
    pq = PriorityQueue()
    t0 = datetime.datetime(2026, 11, 8, 10, 0, 0)
    t1 = datetime.datetime(2026, 11, 8, 10, 5, 0)
    t2 = datetime.datetime(2026, 11, 8, 10, 10, 0)
    
    # Insert Senior Citizen (SS, age 70), Ladies (LD, age 30), and General (GN, age 25)
    pq.push(PriorityQueueEntry(passenger_id=1, pnr="P1", quota="GN", age=25, timestamp=t0))
    pq.push(PriorityQueueEntry(passenger_id=2, pnr="P2", quota="SS", age=70, timestamp=t2))
    pq.push(PriorityQueueEntry(passenger_id=3, pnr="P3", quota="LD", age=30, timestamp=t1))
    
    # Top priority must be Senior Citizen despite later booking time
    top = pq.pop()
    assert top.passenger_id == 2
    assert top.quota == "SS"
    
    # Next must be Ladies quota
    second = pq.pop()
    assert second.passenger_id == 3
    assert second.quota == "LD"
    
    # Then General
    third = pq.pop()
    assert third.passenger_id == 1
    assert third.quota == "GN"


def test_waiting_queue_fifo():
    wq = WaitingQueue()
    wq.enqueue("RAC_1")
    wq.enqueue("RAC_2")
    wq.enqueue("RAC_3")
    
    assert len(wq) == 3
    assert wq.dequeue() == "RAC_1"
    
    # Cancellation in between
    wq.remove_by_predicate(lambda x: x == "RAC_2")
    assert len(wq) == 1
    assert wq.dequeue() == "RAC_3"
    assert wq.is_empty() is True


def test_reservation_chart_sorting():
    unsorted_chart = [
        {"coach_code": "S2", "berth_number": 15, "passenger_name": "Bob"},
        {"coach_code": "B1", "berth_number": 8, "passenger_name": "Alice"},
        {"coach_code": "A1", "berth_number": 2, "passenger_name": "Charlie"},
        {"coach_code": "B1", "berth_number": 3, "passenger_name": "Dave"},
        {"coach_code": "S2", "berth_number": 4, "passenger_name": "Eve"},
    ]
    
    sorted_chart = merge_sort_chart(unsorted_chart)
    
    # Expected order: A1-2, B1-3, B1-8, S2-4, S2-15
    expected = [
        ("A1", 2),
        ("B1", 3),
        ("B1", 8),
        ("S2", 4),
        ("S2", 15)
    ]
    result = [(item["coach_code"], item["berth_number"]) for item in sorted_chart]
    assert result == expected

