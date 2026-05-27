from datetime import datetime, timezone, timedelta


def calculate_sm2(
    ease_factor: float,
    interval_days: float,
    repetition_count: int,
    grade: int,
) -> tuple[float, float, int]:
    """
    SuperMemo-2 algorithm.

    Args:
        ease_factor: Current ease factor (minimum 1.3).
        interval_days: Current interval in days.
        repetition_count: Number of consecutive correct reviews.
        grade: 1=Again, 2=Hard, 3=Good, 4=Easy.

    Returns:
        Tuple of (new_ease_factor, new_interval_days, new_repetition_count).
    """
    if grade >= 3:
        if repetition_count == 0:
            new_interval = 1.0
        elif repetition_count == 1:
            new_interval = 6.0
        else:
            new_interval = interval_days * ease_factor
        new_repetition_count = repetition_count + 1
    else:
        new_interval = 1.0
        new_repetition_count = 0

    new_ease_factor = ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    if new_ease_factor < 1.3:
        new_ease_factor = 1.3

    return new_ease_factor, new_interval, new_repetition_count


def get_next_review_date(interval_days: float) -> datetime:
    """Calculate the next review datetime from now + interval_days."""
    return datetime.now(timezone.utc) + timedelta(days=interval_days)
