# src/features.py
"""Lag, rolling, calendar features and the 2-hour-ahead target (Guide 8.1)."""
import numpy as np
import pandas as pd

HORIZON = 2

FEATURES = [
    "lag_1h", "lag_2h", "lag_24h", "lag_168h", "roll_3h_mean", "roll_24h_mean",
    "neighbour_speed_t",
    "temperature", "humidity", "precipitation",
    "hour_sin", "hour_cos", "dow", "is_weekend", "month", "is_holiday",
]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Every feature uses only the current hour t or the past. The target is the speed at t + 2h
    and is a label only. Requires one row per segment per hour, with no gaps in time.
    """
    df = df.sort_values(["segment_id", "timestamp"]).copy()
    g = df.groupby("segment_id")["speed_kmh"]

    # Past-only lags and rolling means (rolling window ends at t, never after)
    df["lag_1h"] = g.shift(1)
    df["lag_2h"] = g.shift(2)
    df["lag_24h"] = g.shift(24)
    df["lag_168h"] = g.shift(168)                      # same hour last week (past only)
    df["roll_3h_mean"] = g.transform(lambda s: s.rolling(3, min_periods=3).mean())
    df["roll_24h_mean"] = g.transform(lambda s: s.rolling(24, min_periods=24).mean())

    # Calendar features (known at time t)
    ts = df["timestamp"]
    df["hour"] = ts.dt.hour
    df["dow"] = ts.dt.dayofweek
    df["month"] = ts.dt.month
    df["is_weekend"] = (df["dow"] >= 5).astype(int)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    # Target: speed two hours later (label only, never a feature)
    df["target_2h"] = g.shift(-HORIZON)
    return df
