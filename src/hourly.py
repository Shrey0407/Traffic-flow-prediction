# src/hourly.py
"""Hourly resampling and segment selection (Guide 7.4 and 7.5)."""
import numpy as np
import pandas as pd


def to_hourly_wide(wide: pd.DataFrame, min_readings: int = 9):
    """
    Average 5-minute readings into hours, per sensor. An hour with fewer than
    `min_readings` valid readings (out of 12) becomes NaN instead of a partial average.
    Returns (hourly_wide, stats) where stats counts the discarded hours.
    """
    counts = wide.resample("h").count()
    means = wide.resample("h").mean()
    hourly = means.where(counts >= min_readings)
    stats = {
        "min_readings": int(min_readings),
        "hours_total": int(counts.size),
        "hours_kept": int(hourly.notna().sum().sum()),
        "hours_no_readings": int((counts == 0).sum().sum()),
        "hours_partial_discarded": int(((counts > 0) & (counts < min_readings)).sum().sum()),
    }
    return hourly, stats


def wide_to_long(hourly_wide: pd.DataFrame) -> pd.DataFrame:
    """Wide hourly table -> long table (timestamp, segment_id, speed_kmh), sorted."""
    hw = hourly_wide.copy()
    hw.index.name = "timestamp"
    long = hw.reset_index().melt(id_vars="timestamp", var_name="segment_id", value_name="speed_kmh")
    long["segment_id"] = long["segment_id"].astype(str)
    return long.sort_values(["segment_id", "timestamp"]).reset_index(drop=True)


def to_hourly(long: pd.DataFrame, min_readings: int = 9) -> pd.DataFrame:
    """Long 5-minute table -> long hourly table (same rule as to_hourly_wide)."""
    wide = long.pivot(index="timestamp", columns="segment_id", values="speed_kmh")
    hourly_wide, _ = to_hourly_wide(wide, min_readings)
    return wide_to_long(hourly_wide)


def eligible_locations(hourly_wide: pd.DataFrame, locs: pd.DataFrame, min_coverage: float):
    """Sensors with enough hourly coverage AND a known location, sorted by longitude."""
    coverage = hourly_wide.notna().mean()
    eligible = set(coverage[coverage >= min_coverage].index)
    elig = locs[locs["sensor_id"].isin(eligible)].sort_values("longitude").reset_index(drop=True)
    return coverage, elig


def pick_spread(elig_locs: pd.DataFrame, n_segments: int) -> list:
    """Pick n sensors evenly spaced by longitude, so they are spread across the network."""
    if len(elig_locs) < n_segments:
        raise ValueError(f"Only {len(elig_locs)} eligible sensors for {n_segments} segments. "
                         "Lower min_coverage in configs/dataset.json.")
    idx = np.linspace(0, len(elig_locs) - 1, n_segments, dtype=int)
    return elig_locs["sensor_id"].iloc[idx].astype(str).tolist()
