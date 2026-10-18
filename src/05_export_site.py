# src/05_export_site.py
"""Stage 6: write the JSON files the website reads (docs/data/).  From the repo root:
    python src/05_export_site.py
The website computes nothing; everything it shows is written here.
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

OUT = Path("docs/data")
OUT.mkdir(parents=True, exist_ok=True)

test = pd.read_parquet("results/test_predictions.parquet")
metrics = pd.read_csv("results/final_test_metrics.csv").iloc[0]
cfg = json.loads(Path("configs/final_model.json").read_text())
final_name = str(metrics["model"])


def r1(s):
    return s.round(1)


# 1. Prediction files: selected model + the two baselines (one file per model, ~1 MB or less)
base = pd.DataFrame({
    "t": test["timestamp"].dt.strftime("%Y-%m-%dT%H:%M"),
    "segment": test["segment_id"].astype(str),
    "actual": r1(test["target_2h"]),
    "persist": r1(test["persist"]),
})
exported = {final_name: test["pred"], "hour_of_week": test["how"], "persistence": test["persist"]}
for name, series in exported.items():
    base.assign(pred=r1(series))[["t", "segment", "actual", "pred", "persist"]].to_json(
        OUT / f"predictions_{name}.json", orient="records")
(OUT / "models.json").write_text(json.dumps(
    [{"model": n, "selected": n == final_name} for n in exported]))

# 2. Metrics table (validation numbers from Stage 4, test numbers from Stage 5)
y = test["target_2h"].to_numpy()


def test_stats(pred):
    e = y - np.asarray(pred)
    return float(np.mean(np.abs(e))), float(np.sqrt(np.mean(e ** 2)))


mae_p = float(metrics["MAE_persistence"])
rows = []
for model, v in cfg["validation_mae"].items():
    row = {"model": model, "val_mae": round(v, 2), "test_mae": None, "test_rmse": None,
           "skill": None, "ci_low": None, "ci_high": None, "selected": model == final_name}
    if model == final_name:
        row.update(test_mae=round(float(metrics["MAE"]), 2), test_rmse=round(float(metrics["RMSE"]), 2),
                   skill=round(float(metrics["skill_vs_persistence"]), 3),
                   ci_low=round(float(metrics["MAE_CI_low"]), 2), ci_high=round(float(metrics["MAE_CI_high"]), 2))
    elif model in ("persistence", "hour_of_week"):
        mae, rmse = test_stats(test["persist"] if model == "persistence" else test["how"])
        row.update(test_mae=round(mae, 2), test_rmse=round(rmse, 2), skill=round(1 - mae / mae_p, 3))
    rows.append(row)
pd.DataFrame(rows).to_json(OUT / "metrics.json", orient="records")

# 3. Error grid (weekday x hour) for the heatmap: per segment and condition
t = test.assign(
    dow=test["timestamp"].dt.dayofweek,
    hour=test["timestamp"].dt.hour,
    rain=np.where(test["precipitation"] > 0, "rain", "dry"),
    abs_err=(test["target_2h"] - test["pred"]).abs(),
    abs_persist=(test["target_2h"] - test["persist"]).abs(),
)
cells = []
for seg in ["all"] + sorted(t["segment_id"].astype(str).unique()):
    sub_s = t if seg == "all" else t[t["segment_id"].astype(str) == seg]
    for cond in ["all", "rain", "dry"]:
        sub = sub_s if cond == "all" else sub_s[sub_s["rain"] == cond]
        if sub.empty:
            continue
        g = (sub.groupby(["dow", "hour"])
                .agg(mae=("abs_err", "mean"), mae_p=("abs_persist", "mean"), n=("abs_err", "size"))
                .reset_index())
        g["skill"] = 1 - g["mae"] / g["mae_p"].replace(0, np.nan)
        g["segment"], g["condition"] = seg, cond
        cells.append(g.drop(columns="mae_p"))
pd.concat(cells).round(3)[["segment", "condition", "dow", "hour", "mae", "skill", "n"]].to_json(
    OUT / "error_grid.json", orient="records")

# 4. Data summary for the Data page
hourly = pd.read_parquet("data/processed/hourly.parquet")
split = json.loads(Path("configs/split.json").read_text())
summary = {
    "dataset": "PEMS-BAY",
    "sensors": int(hourly["segment_id"].nunique()),
    "segments": sorted(hourly["segment_id"].astype(str).unique().tolist()),
    "start": str(hourly["timestamp"].min().date()),
    "end": str(hourly["timestamp"].max().date()),
    "rows": int(len(hourly)),
    "missing_rate": round(float(hourly["speed_kmh"].isna().mean()), 4),
    "train_end": split["t1"][:10],
    "val_end": split["t2"][:10],
    "test_start": split["splits"]["test"]["start"][:10],
    "test_end": split["splits"]["test"]["end"][:10],
    "n_train": split["splits"]["train"]["rows"],
    "n_val": split["splits"]["val"]["rows"],
    "n_test": split["splits"]["test"]["rows"],
}
(OUT / "data_summary.json").write_text(json.dumps(summary, indent=2))

print("Exported to docs/data/:", sorted(p.name for p in OUT.glob("*.json")))
