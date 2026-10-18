# src/baselines.py
"""Persistence and hour-of-week baselines (Guide 8.2).

Run from the repository root:  python src/baselines.py
Prints MAE on validation and test. Do not look at any other test result before Week 3.
"""
import os
from pathlib import Path

import numpy as np
import pandas as pd


def persistence_predict(df: pd.DataFrame) -> np.ndarray:
    """Forecast = the current speed."""
    return df["speed_kmh"].to_numpy()


def hour_of_week_predict(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Forecast = mean target for the same (segment, weekday, hour) in the TRAINING data."""
    means = train.groupby(["segment_id", "dow", "hour"])["target_2h"].mean()
    key = pd.MultiIndex.from_frame(test[["segment_id", "dow", "hour"]])
    pred = means.reindex(key).to_numpy()
    fallback = train.groupby("segment_id")["target_2h"].mean().reindex(test["segment_id"]).to_numpy()
    return np.where(np.isnan(pred), fallback, pred)


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    train = pd.read_parquet("data/processed/train.parquet")
    val = pd.read_parquet("data/processed/val.parquet")
    test = pd.read_parquet("data/processed/test.parquet")
    trainval = pd.concat([train, val], ignore_index=True)

    def mae(y, p):
        return float(np.mean(np.abs(np.asarray(y) - np.asarray(p))))

    rows = [
        {"baseline": "persistence", "val_mae": mae(val["target_2h"], persistence_predict(val)),
         "test_mae": mae(test["target_2h"], persistence_predict(test))},
        {"baseline": "hour_of_week", "val_mae": mae(val["target_2h"], hour_of_week_predict(train, val)),
         # for the test set the profile is fitted on train + validation (same as the final model)
         "test_mae": mae(test["target_2h"], hour_of_week_predict(trainval, test))},
    ]
    out = pd.DataFrame(rows).round(3)
    Path("results").mkdir(exist_ok=True)
    out.to_csv("results/baseline_metrics.csv", index=False)
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()
