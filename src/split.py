# src/split.py
"""Chronological 60/20/20 split with a gap, so a row's target never lands in the next block."""
import numpy as np
import pandas as pd


def chronological_split(df: pd.DataFrame, gap_hours: int = 2, train_frac: float = 0.6, val_frac: float = 0.2):
    """
    Returns train, val, test (each sorted by timestamp, then segment) and the boundaries t1, t2.
      train: timestamp + gap <  t1
      val  : t1 <= timestamp and timestamp + gap < t2
      test : timestamp >= t2
    Sorting by time matters: TimeSeriesSplit in Stage 4 splits by row order.
    """
    gap = pd.Timedelta(hours=gap_hours)
    times = np.sort(df["timestamp"].unique())
    t1 = pd.Timestamp(times[int(train_frac * len(times))])
    t2 = pd.Timestamp(times[int((train_frac + val_frac) * len(times))])

    ts = df["timestamp"]
    order = ["timestamp", "segment_id"]
    train = df[ts + gap < t1].sort_values(order).reset_index(drop=True)
    val = df[(ts >= t1) & (ts + gap < t2)].sort_values(order).reset_index(drop=True)
    test = df[ts >= t2].sort_values(order).reset_index(drop=True)
    return train, val, test, t1, t2
