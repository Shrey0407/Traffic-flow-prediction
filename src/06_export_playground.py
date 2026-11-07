# src/06_export_playground.py
"""Stage 7: write docs/data/playground.json, the per-row table behind the interactive website.  From the repo root:
    python src/06_export_playground.py

What it writes
  test : the 6,872 test rows with actual speed, persistence, hour-of-week and the SELECTED model.
         Read straight from results/test_predictions.parquet. No model is refitted and no other model is scored on test.
  val  : the 6,848 validation rows with ALL nine methods. Models are refitted on the TRAINING block only,
         with the frozen settings in configs/final_model.json (same recipe as 03_train_select.py).
         Validation is the block that was already used for selection, so showing every model there adds no test leakage.

The browser does the filtering and averaging. Nothing here changes a model, a feature or a number in results/.
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

BASE = pd.Timestamp("2017-01-01 00:00:00")      # hour index 0; timestamps are naive local time
VAL_ORDER = ["persistence", "hour_of_week", "linear", "ridge", "lasso",
             "decision_tree", "random_forest", "xgboost", "voting_ensemble"]


def _f(s, nd=3):
    """Float column -> list with NaN as None, rounded (JSON keeps it short)."""
    return [None if (v is None or (isinstance(v, float) and np.isnan(v))) else round(float(v), nd) for v in np.asarray(s, dtype=float)]


def build_block(df: pd.DataFrame, preds: dict, segments: list) -> dict:
    """df needs: timestamp, segment_id, target_2h, speed_kmh, precipitation, is_holiday.
    preds maps method name -> array of forecasts aligned with df.  Returns a column-oriented dict."""
    h = ((df["timestamp"] - BASE).dt.total_seconds() / 3600).round().astype(int)
    seg_idx = df["segment_id"].astype(str).map({s: i for i, s in enumerate(segments)})
    if seg_idx.isna().any():
        raise ValueError("a segment is missing from the segment list")
    block = {
        "n": int(len(df)),
        "h": h.tolist(),                                           # hours since 2017-01-01 00:00 (local, naive)
        "seg": seg_idx.astype(int).tolist(),                       # index into "segments"
        "rain": (df["precipitation"].fillna(0).to_numpy() > 0).astype(int).tolist(),
        "hol": df["is_holiday"].fillna(0).astype(int).tolist(),
        "actual": _f(df["target_2h"]),                             # speed at t + 2 (km/h)
        "now": _f(df["speed_kmh"]),                                # speed at t (km/h) = the persistence forecast
        "pred": {name: _f(p) for name, p in preds.items() if name != "persistence"},
        "models": [m for m in VAL_ORDER if m in preds],
    }
    return block


def mae(y, p):
    return float(np.mean(np.abs(np.asarray(y, dtype=float) - np.asarray(p, dtype=float))))


def main():
    from baselines import hour_of_week_predict
    from features import FEATURES
    from models import apply_params, candidate_models, make_voting

    cfg = json.loads(Path("configs/final_model.json").read_text())
    train = pd.read_parquet("data/processed/train.parquet").sort_values(["timestamp", "segment_id"]).reset_index(drop=True)
    val = pd.read_parquet("data/processed/val.parquet")
    test_pred = pd.read_parquet("results/test_predictions.parquet")

    segments = sorted(pd.concat([train["segment_id"], val["segment_id"], test_pred["segment_id"]]).astype(str).unique())

    # ---- TEST: copied from the stored predictions (selected model + two baselines) ----
    test_preds = {"persistence": test_pred["persist"], "hour_of_week": test_pred["how"], cfg["selected"]: test_pred["pred"]}
    test_block = build_block(test_pred, test_preds, segments)

    # ---- VALIDATION: refit every candidate on TRAIN only, frozen settings ----
    models = apply_params(candidate_models(), cfg["params"])
    X_tr, y_tr, X_va = train[FEATURES], train["target_2h"], val[FEATURES]
    val_preds = {"persistence": val["speed_kmh"].to_numpy(), "hour_of_week": hour_of_week_predict(train, val)}
    for name, model in models.items():
        print(f"Refitting {name} on train ...", flush=True)
        val_preds[name] = model.fit(X_tr, y_tr).predict(X_va)
    ens = make_voting(cfg["ensemble_members"], models).fit(X_tr, y_tr)
    val_preds["voting_ensemble"] = ens.predict(X_va)
    val_block = build_block(val, val_preds, segments)

    # ---- checks against numbers already in the repo (warn, do not stop) ----
    y_va = val["target_2h"].to_numpy()
    for name, p in val_preds.items():
        ref = cfg["validation_mae"].get(name)
        got = mae(y_va, p)
        flag = "" if ref is None or abs(got - ref) < 0.02 else "   <-- differs from configs/final_model.json, check"
        print(f"  val MAE {name:16s} {got:7.3f}  (stored {ref if ref is None else round(ref, 3)}){flag}")
    fm = pd.read_csv("results/final_test_metrics.csv").iloc[0]
    got = mae(test_pred["target_2h"], test_pred["pred"])
    print(f"  test MAE {cfg['selected']}: {got:.3f}  (stored {fm['MAE']:.3f})")
    assert abs(got - fm["MAE"]) < 0.005, "exported test MAE does not match results/final_test_metrics.csv"

    out = {
        "note": "val: all methods, models fitted on the training block only. test: selected model + baselines only, by design.",
        "base": str(BASE),
        "selected": cfg["selected"],
        "segments": segments,
        "val": val_block,
        "test": test_block,
    }
    path = Path("docs/data/playground.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {path}  ({path.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
