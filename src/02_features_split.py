# src/02_features_split.py
"""Stage 3: features + chronological 60/20/20 split with 2-hour gaps.  Run from the repo root:
    python src/02_features_split.py
"""
import json
import os
from pathlib import Path

import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

from features import FEATURES, build_features
from split import chronological_split

GAP_HOURS = 2

df = pd.read_parquet("data/processed/hourly.parquet")
df = build_features(df)
before = len(df)
df = df.dropna(subset=FEATURES + ["target_2h"])        # rows without a full past or a target
print(f"Kept {len(df)} of {before} rows after dropping incomplete ones")

train, val, test, t1, t2 = chronological_split(df, gap_hours=GAP_HOURS)

info = {"t1": str(t1), "t2": str(t2), "gap_hours": GAP_HOURS, "splits": {}}
for name, part in [("train", train), ("val", val), ("test", test)]:
    part.to_parquet(f"data/processed/{name}.parquet", index=False)
    info["splits"][name] = {
        "rows": int(len(part)),
        "start": str(part["timestamp"].min()),
        "end": str(part["timestamp"].max()),
    }
    print(f"{name:5s} rows={len(part):7d}  {part['timestamp'].min()}  ->  {part['timestamp'].max()}")

Path("configs").mkdir(exist_ok=True)
Path("configs/split.json").write_text(json.dumps(info, indent=2))

if len(test) < 500:
    print("WARNING: the test set is small, so MAE will be unstable. Consider a longer test window.")
assert train["timestamp"].max() < val["timestamp"].min() < test["timestamp"].min(), "splits overlap in time"
