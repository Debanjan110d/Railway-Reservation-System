from typing import List, Dict, Any, Callable

def coach_sort_key(coach_code: str) -> tuple:
    """
    Parses coach codes (e.g., 'A1', 'B2', 'S3', 'GEN1') into:
    (coach_class_weight, coach_index)
    
    Standard Indian Railway Order:
    1AC ('A') -> 2AC ('B') -> 3AC ('C'/'M') -> Sleeper ('S') -> General ('GEN')
    """
    prefix = ""
    num = ""
    for char in coach_code:
        if char.isalpha():
            prefix += char
        elif char.isdigit():
            num += char
            
    coach_order = {
        "A": 1,  # 1st AC / 2nd AC
        "B": 2,  # 3AC
        "M": 2,  # 3AC Economy
        "S": 3,  # Sleeper
        "SL": 3,
        "GEN": 4,
        "GS": 4
    }
    class_weight = coach_order.get(prefix.upper(), 5)
    index = int(num) if num else 0
    return (class_weight, prefix, index)


def compare_berth_records(a: Dict[str, Any], b: Dict[str, Any]) -> int:
    """
    Comparator function for sorting Reservation Chart records.
    Sort Criteria:
    1. Coach identifier ascending (using coach_sort_key)
    2. Berth number ascending
    
    Returns:
        -1 if a < b
         0 if a == b
         1 if a > b
    """
    key_a = coach_sort_key(a.get("coach_code", ""))
    key_b = coach_sort_key(b.get("coach_code", ""))
    
    if key_a < key_b:
        return -1
    elif key_a > key_b:
        return 1
        
    # Same coach -> Compare berth numbers
    num_a = a.get("berth_number", 0)
    num_b = b.get("berth_number", 0)
    if num_a < num_b:
        return -1
    elif num_a > num_b:
        return 1
    return 0


def merge_sort_chart(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Custom Merge Sort Implementation for Reservation Chart Sorting.
    
    Academic Complexity:
    - Best Case Time: O(N log N)
    - Average Case Time: O(N log N)
    - Worst Case Time: O(N log N)
    - Auxiliary Space: O(N)
    - Stability: STABLE (Preserves original relative order of equal berths)
    """
    if len(records) <= 1:
        return records

    mid = len(records) // 2
    left = merge_sort_chart(records[:mid])
    right = merge_sort_chart(records[mid:])

    return _merge(left, right)


def _merge(left: List[Dict[str, Any]], right: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged = []
    i = 0
    j = 0

    while i < len(left) and j < len(right):
        if compare_berth_records(left[i], right[j]) <= 0:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1

    while i < len(left):
        merged.append(left[i])
        i += 1

    while j < len(right):
        merged.append(right[j])
        j += 1

    return merged

