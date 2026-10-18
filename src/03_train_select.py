# src/03_train_select.py
"""Stage 4: tune on TRAINING folds, score on VALIDATION, choose the model.  Run from the repo root:
    python src/03_train_select.py
The test set is never read here.
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit

from baselines import hour_of_week_predict
from features import FEATURES
from models import candidate_models, make_voting

# Sorted by time so TimeSeriesSplit makes forward-chaining folds (see split.py)
train = pd.read_parquet("data/processed/train.parquet").sort_values(["timestamp", "segment_id"]).reset_index(drop=True)
val = pd.read_parquet("data/processed/val.parquet")
X_tr, y_tr = train[FEATURES], train["target_2h"]
X_va, y_va = val[FEATURES], val["target_2h"]

# Inner folds: forward chaining, with a gap of 2 hours (rows are stacked by segment at each hour)
n_seg = train["segment_id"].nunique()
cv = TimeSeriesSplit(n_splits=4, gap=2 * n_seg)

# Grids kept small and documented
grids = {
    "ridge": {"ridge__alpha": [0.1, 1, 10, 100]},
    "lasso": {"lasso__alpha": [0.01, 0.1, 1]},
    "decision_tree": {"decisiontreeregressor__max_depth": [4, 8, 12]},
    "random_forest": {"randomforestregressor__max_depth": [8, 12]},
    "xgboost": {"xgbregressor__max_depth": [4, 6], "xgbregressor__learning_rate": [0.05, 0.1]},
}

models = candidate_models()
tuned, val_mae, params = {}, {}, {}

for name, model in models.items():
    print(f"Fitting {name} ...", flush=True)
    if name in grids:
        search = GridSearchCV(model, grids[name], cv=cv, scoring="neg_mean_absolute_error", n_jobs=-1)
        search.fit(X_tr, y_tr)                          # training data only
        best = search.best_estimator_
        params[name] = search.best_params_
    else:
        best = model.fit(X_tr, y_tr)
        params[name] = "default"
    tuned[name] = best
    val_mae[name] = float(mean_absolute_error(y_va, best.predict(X_va)))

# Baselines on validation
val_mae["persistence"] = float(mean_absolute_error(y_va, val["speed_kmh"]))
val_mae["hour_of_week"] = float(mean_absolute_error(y_va, hour_of_week_predict(train, val)))

# Ensemble from the top three fitted models on validation
ranked = sorted((v, k) for k, v in val_mae.items() if k in tuned)
top3 = [k for _, k in ranked[:3]]
ens = make_voting(top3, tuned).fit(X_tr, y_tr)
val_mae["voting_ensemble"] = float(mean_absolute_error(y_va, ens.predict(X_va)))

best_name = min((k for k in val_mae if k not in ("persistence", "hour_of_week")), key=val_mae.get)


def _plain(o):
    return o.item() if hasattr(o, "item") else str(o)


Path("configs").mkdir(exist_ok=True)
Path("configs/final_model.json").write_text(json.dumps({
    "selected": best_name,
    "ensemble_members": top3,
    "params": params,
    "validation_mae": val_mae,
}, indent=2, default=_plain))

Path("results").mkdir(exist_ok=True)
table = pd.Series(val_mae, name="val_mae").sort_values()
table.to_csv("results/validation_metrics.csv", header=True, index_label="model")
print(table.round(3).to_string())
print("Selected on validation:", best_name)
