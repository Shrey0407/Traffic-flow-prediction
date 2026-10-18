# src/04_final_test.py
"""Stage 5: refit the frozen model on train + validation and score the test set ONCE.  From the repo root:
    python src/04_final_test.py
Do not change configs/final_model.json after seeing these numbers.
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

from baselines import hour_of_week_predict
from evaluate import breakdown, report
from features import FEATURES
from models import apply_params, candidate_models, make_voting
from uncertainty import bootstrap_mae_ci

cfg = json.loads(Path("configs/final_model.json").read_text())
train = pd.read_parquet("data/processed/train.parquet")
val = pd.read_parquet("data/processed/val.parquet")
test = pd.read_parquet("data/processed/test.parquet")

trainval = pd.concat([train, val], ignore_index=True)
X_tv, y_tv = trainval[FEATURES], trainval["target_2h"]
X_te, y_te = test[FEATURES], test["target_2h"]

# Rebuild the selected model with the frozen (tuned) settings
models = apply_params(candidate_models(), cfg["params"])
if cfg["selected"] == "voting_ensemble":
    final = make_voting(cfg["ensemble_members"], models)
else:
    final = models[cfg["selected"]]
final.fit(X_tv, y_tv)

pred = final.predict(X_te)
persist = test["speed_kmh"].to_numpy()
how = hour_of_week_predict(trainval, test)

m = report(y_te, pred, persist)
abs_err = np.abs(y_te.to_numpy() - pred)
lo, hi = bootstrap_mae_ci(abs_err, test["timestamp"].dt.date.to_numpy())
m.update({
    "MAE_CI_low": lo, "MAE_CI_high": hi, "model": cfg["selected"],
    "MAE_hour_of_week": float(np.mean(np.abs(y_te.to_numpy() - how))),
    "RMSE_persistence": float(np.sqrt(np.mean((y_te.to_numpy() - persist) ** 2))),
    "RMSE_hour_of_week": float(np.sqrt(np.mean((y_te.to_numpy() - how) ** 2))),
    "n_test": int(len(test)),
    "test_start": str(test["timestamp"].min()),
    "test_end": str(test["timestamp"].max()),
})

Path("results").mkdir(exist_ok=True)
pd.DataFrame([m]).to_csv("results/final_test_metrics.csv", index=False)

out = test.assign(pred=pred, persist=persist, how=how)
out.to_parquet("results/test_predictions.parquet", index=False)

# Error breakdowns (Guide 8.5)
out = out.assign(rain=np.where(out["precipitation"] > 0, "rain", "dry"))
for by in ["segment_id", "hour", "dow", "rain"]:
    breakdown(out, by).round(4).to_csv(f"results/breakdown_{by}.csv", index=False)

print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items()})
