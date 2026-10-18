# src/evaluate.py
"""Metrics and error breakdowns (Guide 8.5)."""
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error


def report(y_true, y_pred, y_persist) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae_p = mean_absolute_error(y_true, y_persist)
    return {"MAE": mae, "RMSE": rmse, "MAE_persistence": mae_p,
            "skill_vs_persistence": 1 - mae / mae_p}


def breakdown(df: pd.DataFrame, by: str) -> pd.DataFrame:
    """df needs columns: target_2h, pred, persist, and the grouping column."""
    rows = []
    for key, g in df.groupby(by):
        mae = np.mean(np.abs(g["target_2h"] - g["pred"]))
        mae_p = np.mean(np.abs(g["target_2h"] - g["persist"]))
        rows.append({by: key, "n": len(g), "MAE": mae, "MAE_persistence": mae_p,
                     "skill": 1 - mae / mae_p})
    return pd.DataFrame(rows)
