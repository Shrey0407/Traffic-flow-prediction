# src/tests/test_leakage.py
"""Automated leakage checks. Run from the repo root:  pytest src/tests

Each test uses small synthetic data, so it runs without the real dataset.
The last test also checks the real train/val/test files if Stage 3 has been run.
"""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from features import FEATURES, HORIZON, build_features
from neighbours import add_neighbour_speed
from split import chronological_split

SEGS = ["a", "b", "c", "d"]


def make_hourly(n_hours=24 * 30, segs=SEGS, seed=0):
    rng = np.random.default_rng(seed)
    ts = pd.date_range("2017-01-01", periods=n_hours, freq="h")
    parts = []
    for s in segs:
        parts.append(pd.DataFrame({
            "timestamp": ts, "segment_id": s,
            "speed_kmh": rng.uniform(20, 100, n_hours),
            "neighbour_speed_t": rng.uniform(20, 100, n_hours),
            "temperature": rng.uniform(5, 25, n_hours),
            "humidity": rng.uniform(30, 90, n_hours),
            "precipitation": rng.choice([0.0, 0.0, 0.0, 1.2], n_hours),
            "is_holiday": 0,
        }))
    return pd.concat(parts, ignore_index=True)


def seg(df, s="a"):
    return df[df["segment_id"] == s].sort_values("timestamp").reset_index(drop=True)


def test_target_is_not_a_feature():
    assert "target_2h" not in FEATURES
    assert not any("target" in f for f in FEATURES)


def test_target_is_two_hours_ahead():
    df = seg(build_features(make_hourly()))
    assert HORIZON == 2
    np.testing.assert_allclose(df["target_2h"].iloc[:-2].to_numpy(), df["speed_kmh"].iloc[2:].to_numpy())
    assert df["target_2h"].iloc[-2:].isna().all()          # no future available at the end


def test_lag_1h_equals_previous_speed():
    df = seg(build_features(make_hourly()))
    np.testing.assert_allclose(df["lag_1h"].iloc[1:].to_numpy(), df["speed_kmh"].iloc[:-1].to_numpy())
    np.testing.assert_allclose(df["lag_24h"].iloc[24:].to_numpy(), df["speed_kmh"].iloc[:-24].to_numpy())
    np.testing.assert_allclose(df["lag_168h"].iloc[168:].to_numpy(), df["speed_kmh"].iloc[:-168].to_numpy())


def test_rolling_mean_uses_past_and_current_only():
    df = seg(build_features(make_hourly()))
    speed = df["speed_kmh"]
    expected = speed.rolling(3).mean()                       # window t-2 .. t
    np.testing.assert_allclose(df["roll_3h_mean"].iloc[2:].to_numpy(), expected.iloc[2:].to_numpy())


def test_changing_the_future_does_not_change_features_at_t():
    raw = make_hourly()
    k = 24 * 10                                              # origin hour index
    cutoff = raw["timestamp"].min() + pd.Timedelta(hours=k)
    altered = raw.copy()
    future = (altered["timestamp"] > cutoff)
    altered.loc[future, "speed_kmh"] = 999.0                 # corrupt everything after t
    a, b = build_features(raw), build_features(altered)
    for df in (a, b):
        df.sort_values(["segment_id", "timestamp"], inplace=True)
    now = a["timestamp"] <= cutoff
    past_feats = ["lag_1h", "lag_2h", "lag_24h", "lag_168h", "roll_3h_mean", "roll_24h_mean"]
    pd.testing.assert_frame_equal(
        a.loc[now, past_feats].reset_index(drop=True),
        b.loc[b["timestamp"] <= cutoff, past_feats].reset_index(drop=True))


def test_neighbour_speed_uses_same_hour_only():
    hourly = make_hourly(n_hours=48)[["timestamp", "segment_id", "speed_kmh"]]
    neigh = {"a": ["b", "c"]}
    out = add_neighbour_speed(hourly, neigh)
    row = out[(out["segment_id"] == "a") & (out["timestamp"] == hourly["timestamp"].iloc[10])]
    t = row["timestamp"].iloc[0]
    expected = hourly[(hourly["timestamp"] == t) & (hourly["segment_id"].isin(["b", "c"]))]["speed_kmh"].mean()
    assert row["neighbour_speed_t"].iloc[0] == pytest.approx(expected)


def test_split_is_chronological_with_gap():
    df = build_features(make_hourly(n_hours=24 * 40)).dropna(subset=FEATURES + ["target_2h"])
    train, val, test, t1, t2 = chronological_split(df, gap_hours=2)
    gap = pd.Timedelta(hours=2)
    assert train["timestamp"].max() < val["timestamp"].min() < test["timestamp"].min()
    # a training row's target time (t + 2h) must fall before the validation block starts
    assert (train["timestamp"] + gap).max() < t1
    assert (val["timestamp"] + gap).max() < t2
    assert test["timestamp"].min() >= t2
    assert len(train) > len(val) > 0 and len(test) > 0


@pytest.mark.skipif(not Path("data/processed/test.parquet").exists(), reason="run Stage 3 first")
def test_real_split_files_are_chronological():
    tr = pd.read_parquet("data/processed/train.parquet")
    va = pd.read_parquet("data/processed/val.parquet")
    te = pd.read_parquet("data/processed/test.parquet")
    assert tr["timestamp"].max() < va["timestamp"].min() < te["timestamp"].min()
    assert (tr["timestamp"] + pd.Timedelta(hours=2)).max() < va["timestamp"].min()
    assert (va["timestamp"] + pd.Timedelta(hours=2)).max() < te["timestamp"].min()
    for df in (tr, va, te):
        assert df[[f for f in FEATURES if f != "lag_168h"] + ["target_2h"]].notna().all().all()
